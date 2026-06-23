package com.neoclarity.api.repository;

import com.neoclarity.api.model.Goal;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface GoalRepository extends JpaRepository<Goal, Long> {
    List<Goal> findByCustomerId(Long customerId);
    List<Goal> findByCustomerIdAndStatus(Long customerId, String status);
    Optional<Goal> findByGoalId(String goalId);
    Optional<Goal> findByGoalIdAndCustomerId(String goalId, Long customerId);
}
