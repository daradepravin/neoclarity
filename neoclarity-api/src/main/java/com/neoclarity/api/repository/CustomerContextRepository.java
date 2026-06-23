package com.neoclarity.api.repository;

import com.neoclarity.api.model.CustomerContext;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CustomerContextRepository extends JpaRepository<CustomerContext, Long> {
    List<CustomerContext> findByCustomerIdAndConfirmedTrue(Long customerId);
}
