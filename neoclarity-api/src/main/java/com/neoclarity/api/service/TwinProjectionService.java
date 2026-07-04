package com.neoclarity.api.service;

import com.neoclarity.api.model.Account;
import com.neoclarity.api.model.Customer;
import com.neoclarity.api.model.Goal;
import com.neoclarity.api.model.Transaction;
import com.neoclarity.api.repository.GoalRepository;
import com.neoclarity.api.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.neo4j.driver.Driver;
import org.neo4j.driver.Session;
import org.neo4j.driver.Values;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * Projects PostgreSQL data into the Neo4j Household Digital Twin.
 *
 * Called after:
 *   1. Account linking — creates Customer, Account, Transaction nodes
 *   2. Goal create/update — syncs Goal nodes
 *   3. Consent revocation — sets Customer.consent_active = false
 *
 * Projection latency target: < 60 seconds (frozen architecture Section 15).
 * All writes are idempotent — uses MERGE not CREATE to avoid duplicates.
 *
 * NOTE: Transaction embedding (the float[] vector on Transaction nodes for
 * Event Intelligence vector search) is written by the FastAPI agent layer
 * after the first /api/agent/analyze call, using sentence-transformers.
 * Spring Boot writes the structural graph; FastAPI adds the semantic layer.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TwinProjectionService {

    private final Driver neo4jDriver;
    private final TransactionRepository transactionRepository;
    private final GoalRepository goalRepository;

    // ── CUSTOMER ──────────────────────────────────────────────────────────────

    @Async
    public void projectCustomer(Customer customer) {
        log.info("twin.project_customer hid={}", customer.getHashedId().substring(0, 8));
        try (Session session = neo4jDriver.session()) {
            session.run("""
                MERGE (c:Customer {hashed_id: $hid})
                SET c.consent_active    = $consent,
                    c.pg_customer_id    = $pg_id,
                    c.created_at        = $created_at
                """,
                Values.parameters(
                    "hid",        customer.getHashedId(),
                    "consent",    customer.isConsentActive(),
                    "pg_id",      customer.getId().toString(),
                    "created_at", customer.getCreatedAt().toString()
                )
            );
            log.debug("twin.customer_done hid={}", customer.getHashedId().substring(0, 8));
        } catch (Exception e) {
            log.error("twin.customer_error hid={} err={}", customer.getHashedId().substring(0, 8), e.getMessage());
        }
    }

    public void updateConsentActive(Customer customer, boolean active) {
        log.info("twin.update_consent hid={} active={}", customer.getHashedId().substring(0, 8), active);
        try (Session session = neo4jDriver.session()) {
            session.run("""
                MATCH (c:Customer {hashed_id: $hid})
                SET c.consent_active = $active
                """,
                Values.parameters("hid", customer.getHashedId(), "active", active)
            );
        } catch (Exception e) {
            log.error("twin.consent_error err={}", e.getMessage());
        }
    }

    // ── ACCOUNT ───────────────────────────────────────────────────────────────

    @Async
    public void projectAccount(Customer customer, Account account) {
        log.info("twin.project_account institution={} type={}", account.getInstitution(), account.getAccountType());
        try (Session session = neo4jDriver.session()) {

            // Ensure customer node exists
            session.run("""
                MERGE (c:Customer {hashed_id: $hid})
                ON CREATE SET c.consent_active = true, c.pg_customer_id = $pg_id
                """,
                Values.parameters("hid", customer.getHashedId(), "pg_id", customer.getId().toString())
            );

            // Account node
            session.run("""
                MERGE (a:Account {account_id: $account_id})
                SET a.institution       = $institution,
                    a.account_type      = $account_type,
                    a.balance           = $balance,
                    a.currency          = $currency,
                    a.is_active         = $is_active,
                    a.linked_at         = $linked_at,
                    a.last_refreshed_at = $refreshed
                """,
                Values.parameters(
                    "account_id",   account.getAccountId(),
                    "institution",  account.getInstitution(),
                    "account_type", account.getAccountType(),
                    "balance",      account.getBalance().doubleValue(),
                    "currency",     account.getCurrency(),
                    "is_active",    account.isActive(),
                    "linked_at",    account.getLinkedAt().toString(),
                    "refreshed",    account.getLastRefreshedAt().toString()
                )
            );

            // HAS_ACCOUNT relationship
            session.run("""
                MATCH (c:Customer {hashed_id: $hid})
                MATCH (a:Account {account_id: $account_id})
                MERGE (c)-[:HAS_ACCOUNT {linked_at: $linked_at}]->(a)
                """,
                Values.parameters(
                    "hid",        customer.getHashedId(),
                    "account_id", account.getAccountId(),
                    "linked_at",  account.getLinkedAt().toString()
                )
            );

            log.debug("twin.account_done account_id={}", account.getAccountId().substring(0, 8));
        } catch (Exception e) {
            log.error("twin.account_error err={}", e.getMessage());
        }
    }

    public void setAccountActive(String accountId, boolean active) {
        try (Session session = neo4jDriver.session()) {
            session.run("""
                MATCH (a:Account {account_id: $account_id})
                SET a.is_active = $active
                """,
                Values.parameters("account_id", accountId, "active", active)
            );
            log.info("twin.account_active_set account_id={} active={}", accountId.substring(0, 8), active);
        } catch (Exception e) {
            log.error("twin.account_active_error err={}", e.getMessage());
        }
    }

    // ── TRANSACTIONS ──────────────────────────────────────────────────────────

    /**
     * Project all unsynced transactions for a customer into Neo4j.
     * Marks each transaction as neo4j_synced=true in PostgreSQL on success.
     * NOTE: embedding[] is NOT set here — the FastAPI agent layer adds it
     * via sentence-transformers during the first analyze call.
     */
    @Async
    public void projectTransactions(Account account) {
        List<Transaction> unsynced = transactionRepository.findByNeo4jSyncedFalse()
                .stream()
                .filter(t -> t.getAccount().getId().equals(account.getId()))
                .toList();

        if (unsynced.isEmpty()) return;

        log.info("twin.project_transactions count={} account_id={}",
                unsynced.size(), account.getAccountId().substring(0, 8));

        try (Session session = neo4jDriver.session()) {
            for (Transaction t : unsynced) {
                try {
                    session.run("""
                        MERGE (t:Transaction {transaction_id: $txn_id})
                        SET t.amount             = $amount,
                            t.merchant_raw        = $merchant_raw,
                            t.merchant_normalised = $merchant_norm,
                            t.category            = $category,
                            t.subcategory         = $subcategory,
                            t.transaction_date    = date($date),
                            t.is_recurring        = $recurring,
                            t.income_flag         = $income,
                            t.confidence          = $confidence
                        WITH t
                        MATCH (a:Account {account_id: $account_id})
                        MERGE (a)-[:CONTAINS]->(t)
                        """,
                        Values.parameters(
                            "txn_id",      t.getTransactionId(),
                            "amount",      t.getAmount().doubleValue(),
                            "merchant_raw", t.getMerchantRaw() != null ? t.getMerchantRaw() : "",
                            "merchant_norm", t.getMerchantNormalised() != null ? t.getMerchantNormalised() : "",
                            "category",    t.getCategory() != null ? t.getCategory() : "Uncategorised",
                            "subcategory", t.getSubcategory() != null ? t.getSubcategory() : "",
                            "date",        t.getTransactionDate().toString(),
                            "recurring",   t.isRecurring(),
                            "income",      t.isIncomeFlag(),
                            "confidence",  t.getConfidence() != null ? t.getConfidence().doubleValue() : 1.0,
                            "account_id",  t.getAccount().getAccountId()
                        )
                    );

                    // Mark synced in PostgreSQL
                    t.setNeo4jSynced(true);
                    transactionRepository.save(t);

                } catch (Exception e) {
                    log.warn("twin.transaction_error txn_id={} err={}",
                            t.getTransactionId(), e.getMessage());
                }
            }
            log.info("twin.transactions_done synced={}", unsynced.size());
        } catch (Exception e) {
            log.error("twin.transactions_error err={}", e.getMessage());
        }
    }

    // ── GOALS ─────────────────────────────────────────────────────────────────

    @Async
    public void projectGoal(Customer customer, Goal goal) {
        log.info("twin.project_goal type={}", goal.getGoalType());
        try (Session session = neo4jDriver.session()) {

            session.run("""
                MERGE (g:Goal {goal_id: $goal_id})
                SET g.goal_type            = $goal_type,
                    g.target_amount        = $target,
                    g.current_amount       = $current,
                    g.monthly_contribution = $monthly,
                    g.deadline             = $deadline,
                    g.status               = $status,
                    g.pg_goal_id           = $pg_id
                WITH g
                MATCH (c:Customer {hashed_id: $hid})
                MERGE (c)-[:HAS_GOAL {created_at: datetime()}]->(g)
                """,
                Values.parameters(
                    "goal_id",   goal.getGoalId(),
                    "goal_type", goal.getGoalType(),
                    "target",    goal.getTargetAmount().doubleValue(),
                    "current",   goal.getCurrentAmount().doubleValue(),
                    "monthly",   goal.getMonthlyContribution().doubleValue(),
                    "deadline",  goal.getDeadline() != null ? goal.getDeadline().toString() : null,
                    "status",    goal.getStatus(),
                    "pg_id",     goal.getId().toString(),
                    "hid",       customer.getHashedId()
                )
            );
            log.debug("twin.goal_done goal_id={}", goal.getGoalId());
        } catch (Exception e) {
            log.error("twin.goal_error err={}", e.getMessage());
        }
    }

    // ── FULL PROJECTION (on first account link) ───────────────────────────────

    /**
     * Full Twin projection for a customer — called after the first account link.
     * Projects customer + all accounts + all transactions + all goals.
     * Subsequent links only project the new account + its transactions.
     */
    @Async
    public void projectFullTwin(Customer customer, List<Account> accounts) {
        log.info("twin.full_projection hid={} accounts={}",
                customer.getHashedId().substring(0, 8), accounts.size());

        projectCustomer(customer);

        for (Account account : accounts) {
            projectAccount(customer, account);
            projectTransactions(account);
        }

        List<Goal> goals = goalRepository.findByCustomerId(customer.getId());
        for (Goal goal : goals) {
            projectGoal(customer, goal);
        }

        log.info("twin.full_projection_complete hid={}", customer.getHashedId().substring(0, 8));
    }

    /**
     * Seeds the two-member household into Neo4j: spouse HouseholdMember node,
     * their Fidelity savings account, and the shared mortgage liability.
     * Safe to call on every startup — all writes use MERGE.
     */
    public void projectHouseholdMembers(Customer customer) {
        log.info("twin.project_household hid={}", customer.getHashedId().substring(0, 8));
        try (Session session = neo4jDriver.session()) {
            session.run("""
                MATCH (c:Customer {hashed_id: $hid})
                MERGE (spouse:HouseholdMember {member_id: $member_id})
                SET spouse.name = 'Alex Demo', spouse.role = 'SPOUSE'
                MERGE (c)-[:HAS_HOUSEHOLD_MEMBER {since: date('2018-06-15')}]->(spouse)
                WITH spouse
                MERGE (sa:Account {account_id: $savings_id})
                SET sa.institution   = 'Fidelity',
                    sa.account_type  = 'SAVINGS',
                    sa.balance       = 12500.0,
                    sa.is_active     = true,
                    sa.label         = 'Spouse Retirement Savings'
                MERGE (spouse)-[:HAS_ACCOUNT]->(sa)
                """,
                Values.parameters(
                    "hid",       customer.getHashedId(),
                    "member_id", "spouse-" + customer.getHashedId().substring(0, 8),
                    "savings_id","fidelity-" + customer.getHashedId().substring(0, 8)
                )
            );
            session.run("""
                MATCH (c:Customer {hashed_id: $hid})
                MERGE (m:Liability {liability_id: $mortgage_id})
                SET m.type             = 'MORTGAGE',
                    m.institution      = 'Chase',
                    m.balance          = 312000.0,
                    m.monthly_payment  = 2150.0,
                    m.interest_rate    = 6.875,
                    m.term_months      = 360,
                    m.start_date       = date('2019-06-01')
                MERGE (c)-[:HAS_LIABILITY {primary: true}]->(m)
                """,
                Values.parameters(
                    "hid",        customer.getHashedId(),
                    "mortgage_id","mortgage-" + customer.getHashedId().substring(0, 8)
                )
            );
            session.run("""
                MATCH (c:Customer {hashed_id: $hid})-[:HAS_GOAL]->(g:Goal {goal_type: 'COLLEGE'})
                MATCH (c)-[:HAS_HOUSEHOLD_MEMBER]->(spouse:HouseholdMember)
                MERGE (spouse)-[:CO_OWNS]->(g)
                """,
                Values.parameters("hid", customer.getHashedId())
            );
            log.info("twin.household_done hid={}", customer.getHashedId().substring(0, 8));
        } catch (Exception e) {
            log.error("twin.household_error err={}", e.getMessage());
        }
    }
}
