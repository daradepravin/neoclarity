package com.neoclarity.api.repository;

import com.neoclarity.api.model.LifeEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface LifeEventRepository extends JpaRepository<LifeEvent, Long> {
    List<LifeEvent> findByCustomerId(Long customerId);
    List<LifeEvent> findByCustomerIdAndConfirmedFalse(Long customerId);
    Optional<LifeEvent> findByEventIdAndCustomerId(String eventId, Long customerId);
}
