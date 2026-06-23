package com.neoclarity.api.repository;

import com.neoclarity.api.model.Customer;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CustomerRepository extends JpaRepository<Customer, Long> {
    Optional<Customer> findByEmail(String email);
    Optional<Customer> findByHashedId(String hashedId);
    boolean existsByEmail(String email);
}
