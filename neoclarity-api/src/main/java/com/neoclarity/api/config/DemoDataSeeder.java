package com.neoclarity.api.config;

import com.neoclarity.api.model.*;
import com.neoclarity.api.repository.*;
import com.neoclarity.api.service.TwinProjectionService;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.UUID;

/**
 * Seeds one demo customer with accounts, goals, a resilience score, a pending
 * Next Best Action recommendation, and an unconfirmed Yellowstone life event —
 * mirroring the UX prototype exactly. Only runs if the demo customer doesn't exist.
 *
 * Login: demo@neoclarity.app / Password123!  (MFA code: 123456)
 */
@Component
@RequiredArgsConstructor
public class DemoDataSeeder {

    private final CustomerRepository customerRepository;
    private final AccountRepository accountRepository;
    private final GoalRepository goalRepository;
    private final ResilienceScoreRepository resilienceScoreRepository;
    private final RecommendationRepository recommendationRepository;
    private final LifeEventRepository lifeEventRepository;
    private final CustomerContextRepository customerContextRepository;
    private final PasswordEncoder passwordEncoder;
    private final TwinProjectionService twinProjectionService;

    private static final String DEMO_EMAIL = "demo@neoclarity.app";

    @EventListener(ApplicationReadyEvent.class)
    public void seed() {
        if (customerRepository.existsByEmail(DEMO_EMAIL)) {
            return;
        }

        Customer customer = Customer.builder()
                .email(DEMO_EMAIL)
                .passwordHash(passwordEncoder.encode("Password123!"))
                .firstName("Pravin")
                .lastName("Demo")
                .hashedId(sha256(DEMO_EMAIL + ":" + UUID.randomUUID()))
                .mfaEnabled(true)
                .consentActive(true)
                .consentGrantedAt(LocalDateTime.now().minusDays(2))
                .build();
        customer = customerRepository.save(customer);

        // ── Context labels ──────────────────────────────────────────────────
        customerContextRepository.save(CustomerContext.builder()
                .customer(customer).label("PARENT").confirmed(true).build());
        customerContextRepository.save(CustomerContext.builder()
                .customer(customer).label("HOMEOWNER").confirmed(true).build());
        customerContextRepository.save(CustomerContext.builder()
                .customer(customer).label("MARRIED").confirmed(true).build());

        // ── Accounts ─────────────────────────────────────────────────────────
        accountRepository.save(Account.builder()
                .accountId(sha256("acc-chase-checking-" + customer.getId()))
                .customer(customer)
                .institution("Chase")
                .accountType("CHECKING")
                .balance(new BigDecimal("4250.00"))
                .build());

        accountRepository.save(Account.builder()
                .accountId(sha256("acc-ally-savings-" + customer.getId()))
                .customer(customer)
                .institution("Ally")
                .accountType("SAVINGS")
                .balance(new BigDecimal("3200.00"))
                .build());

        accountRepository.save(Account.builder()
                .accountId(sha256("acc-chase-credit-" + customer.getId()))
                .customer(customer)
                .institution("Chase")
                .accountType("CREDIT")
                .balance(new BigDecimal("-1840.00"))
                .build());

        // ── Goals (matches the 3 goals in the prototype) ────────────────────
        goalRepository.save(Goal.builder()
                .customer(customer)
                .goalType("EMERGENCY_FUND")
                .targetAmount(new BigDecimal("15000.00"))
                .currentAmount(new BigDecimal("3200.00"))
                .monthlyContribution(new BigDecimal("300.00"))
                .deadline(LocalDate.of(2027, 8, 1))
                .status("ACTIVE")
                .build());

        goalRepository.save(Goal.builder()
                .customer(customer)
                .goalType("VACATION")
                .targetAmount(new BigDecimal("5000.00"))
                .currentAmount(new BigDecimal("1500.00"))
                .monthlyContribution(new BigDecimal("200.00"))
                .deadline(LocalDate.of(2027, 5, 1))
                .status("ACTIVE")
                .build());

        goalRepository.save(Goal.builder()
                .customer(customer)
                .goalType("COLLEGE")
                .targetAmount(new BigDecimal("15000.00"))
                .currentAmount(new BigDecimal("3000.00"))
                .monthlyContribution(new BigDecimal("150.00"))
                .deadline(LocalDate.of(2032, 6, 1))
                .status("ACTIVE")
                .build());

        // ── Resilience Score (matches prototype: 68, Emergency Fund weakest) ─
        ResilienceScore score = resilienceScoreRepository.save(ResilienceScore.builder()
                .customer(customer)
                .overallScore(68)
                .emergencyFundScore(30)
                .cashFlowScore(72)
                .debtBurdenScore(65)
                .incomeStabilityScore(80)
                .goalReadinessScore(45)
                .triggeredBy("ACCOUNT_LINK")
                .computedAt(LocalDateTime.now())
                .build());

        // Prior month score, for the "+4 this month" trend
        resilienceScoreRepository.save(ResilienceScore.builder()
                .customer(customer)
                .overallScore(64)
                .emergencyFundScore(26)
                .cashFlowScore(70)
                .debtBurdenScore(63)
                .incomeStabilityScore(80)
                .goalReadinessScore(41)
                .triggeredBy("REFRESH")
                .computedAt(LocalDateTime.now().minusDays(30))
                .build());

        // ── Next Best Action (HIGH priority — Emergency Fund) ───────────────
        Goal emergencyFund = goalRepository.findByCustomerId(customer.getId()).get(0);

        recommendationRepository.save(Recommendation.builder()
                .customer(customer)
                .agent("FinancialAssessmentAgent")
                .priority("HIGH")
                .reason("Emergency fund covers only 1.8 months of expenses. Target is 6 months.")
                .recommendationText("Increase Emergency Fund Savings by $100/month")
                .expectedImpact("Reach target coverage 4 months sooner. +12 Clarity Points.")
                .confidence(new BigDecimal("0.91"))
                .requiresApproval(true)
                .goal(emergencyFund)
                .sessionId("seed-session-001")
                .response("PENDING")
                .build());

        // Two secondary recommendations
        recommendationRepository.save(Recommendation.builder()
                .customer(customer)
                .agent("FinancialAssessmentAgent")
                .priority("MEDIUM")
                .reason("Dining spend increased 18% vs your 90-day baseline.")
                .recommendationText("Reduce dining spend by $50/month")
                .expectedImpact("Improve cash flow stability score by 8 points.")
                .confidence(new BigDecimal("0.78"))
                .requiresApproval(true)
                .sessionId("seed-session-001")
                .response("PENDING")
                .build());

        recommendationRepository.save(Recommendation.builder()
                .customer(customer)
                .agent("GoalPlanningAgent")
                .priority("LOW")
                .reason("College fund is behind recommended trajectory.")
                .recommendationText("Start additional College Fund contributions")
                .expectedImpact("Close the college savings gap 2 years sooner.")
                .confidence(new BigDecimal("0.72"))
                .requiresApproval(true)
                .sessionId("seed-session-001")
                .response("PENDING")
                .build());

        // ── Unconfirmed life event — Yellowstone ────────────────────────────
        lifeEventRepository.save(LifeEvent.builder()
                .customer(customer)
                .eventType("VACATION")
                .label("Yellowstone Family Vacation")
                .totalCost(new BigDecimal("4200.00"))
                .transactionCount(4)
                .detectionConfidence(new BigDecimal("0.87"))
                .confirmed(false)
                .dateRangeStart(LocalDate.of(2026, 5, 22))
                .dateRangeEnd(LocalDate.of(2026, 5, 27))
                .build());

        // Confirmed event — Soccer Season
        lifeEventRepository.save(LifeEvent.builder()
                .customer(customer)
                .eventType("CHILD_ACTIVITY")
                .label("Soccer Season — Spring 2026")
                .totalCost(new BigDecimal("1340.00"))
                .transactionCount(6)
                .detectionConfidence(new BigDecimal("0.93"))
                .confirmed(true)
                .confirmedAt(LocalDateTime.now().minusDays(10))
                .dateRangeStart(LocalDate.of(2026, 2, 1))
                .dateRangeEnd(LocalDate.of(2026, 4, 30))
                .build());

        // Project demo customer + accounts + goals into Neo4j Twin
        // This runs async so it doesn't block application startup.
        var accounts = accountRepository.findByCustomerId(customer.getId());
        twinProjectionService.projectFullTwin(customer, accounts);

        // Seed two-member household structure (spouse + mortgage + shared goal)
        // Synchronous — needs customer node to exist first; runs after projectCustomer completes.
        // Small startup delay to let the async projectCustomer finish.
        final Customer seededCustomer = customer;
        new Thread(() -> {
            try { Thread.sleep(3000); } catch (InterruptedException ignored) {}
            twinProjectionService.projectHouseholdMembers(seededCustomer);
        }, "household-seeder").start();
    }

    private static String sha256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
