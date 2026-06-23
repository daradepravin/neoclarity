package com.neoclarity.api.repository;

import com.neoclarity.api.model.Recommendation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RecommendationRepository extends JpaRepository<Recommendation, Long> {
    List<Recommendation> findByCustomerIdOrderByPriorityAscCreatedAtDesc(Long customerId);
    List<Recommendation> findByCustomerIdAndResponse(Long customerId, String response);
    Optional<Recommendation> findByRecommendationIdAndCustomerId(String recommendationId, Long customerId);
}
