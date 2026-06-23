package com.neoclarity.api.controller;

import com.neoclarity.api.exception.ApiException;
import com.neoclarity.api.model.Customer;
import com.neoclarity.api.model.LifeEvent;
import com.neoclarity.api.repository.LifeEventRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/events")
@RequiredArgsConstructor
public class LifeEventController {

    private final LifeEventRepository lifeEventRepository;

    @GetMapping
    public ResponseEntity<List<LifeEvent>> getAll(@AuthenticationPrincipal Customer customer) {
        return ResponseEntity.ok(lifeEventRepository.findByCustomerId(customer.getId()));
    }

    @PostMapping("/{eventId}/confirm")
    public ResponseEntity<LifeEvent> confirm(
            @AuthenticationPrincipal Customer customer,
            @PathVariable String eventId
    ) {
        LifeEvent event = lifeEventRepository.findByEventIdAndCustomerId(eventId, customer.getId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Event not found"));

        event.setConfirmed(true);
        event.setConfirmedAt(LocalDateTime.now());
        // TODO Week 5: write BELONGS_TO relationships in Neo4j via FastAPI
        return ResponseEntity.ok(lifeEventRepository.save(event));
    }

    @PostMapping("/{eventId}/reject")
    public ResponseEntity<Void> reject(
            @AuthenticationPrincipal Customer customer,
            @PathVariable String eventId
    ) {
        LifeEvent event = lifeEventRepository.findByEventIdAndCustomerId(eventId, customer.getId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Event not found"));

        lifeEventRepository.delete(event);
        return ResponseEntity.noContent().build();
    }
}
