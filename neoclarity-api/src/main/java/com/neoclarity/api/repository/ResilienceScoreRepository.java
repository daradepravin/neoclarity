package com.neoclarity.api.repository;

import com.neoclarity.api.model.ResilienceScore;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ResilienceScoreRepository extends JpaRepository<ResilienceScore, Long> {
    List<ResilienceScore> findByCustomerIdOrderByComputedAtDesc(Long customerId);
    Optional<ResilienceScore> findFirstByCustomerIdOrderByComputedAtDesc(Long customerId);
}
