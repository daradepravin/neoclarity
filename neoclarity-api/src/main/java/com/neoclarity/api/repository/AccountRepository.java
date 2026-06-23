package com.neoclarity.api.repository;

import com.neoclarity.api.model.Account;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AccountRepository extends JpaRepository<Account, Long> {
    List<Account> findByCustomerIdAndActiveTrue(Long customerId);
    List<Account> findByCustomerId(Long customerId);
    Optional<Account> findByAccountIdAndCustomerId(String accountId, Long customerId);
    List<Account> findByCustomerIdAndInstitution(Long customerId, String institution);
}
