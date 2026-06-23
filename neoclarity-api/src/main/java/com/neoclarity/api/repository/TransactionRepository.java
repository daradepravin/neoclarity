package com.neoclarity.api.repository;

import com.neoclarity.api.model.Transaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

public interface TransactionRepository extends JpaRepository<Transaction, Long> {
    List<Transaction> findByAccountIdAndTransactionDateGreaterThanEqual(Long accountId, LocalDate since);
    List<Transaction> findByAccountCustomerIdAndTransactionDateGreaterThanEqual(Long customerId, LocalDate since);
    List<Transaction> findByNeo4jSyncedFalse();

    @Modifying
    @Transactional
    @Query("DELETE FROM Transaction t WHERE t.account.id = :accountId")
    void deleteByAccountId(Long accountId);

    @Modifying
    @Transactional
    @Query("DELETE FROM Transaction t WHERE t.account.customer.id = :customerId")
    void deleteByCustomerId(Long customerId);
}
