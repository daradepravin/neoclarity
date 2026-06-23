package com.neoclarity.api.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/** Confirmed persona labels — PARENT, HOMEOWNER, etc. Never inferred, only customer-confirmed. */
@Entity
@Table(name = "customer_context", uniqueConstraints = @UniqueConstraint(columnNames = {"customer_id", "label"}))
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CustomerContext {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id", nullable = false)
    private Customer customer;

    /** PARENT | HOMEOWNER | CAREGIVER | STUDENT | SELF_EMPLOYED | MARRIED */
    @Column(nullable = false, length = 50)
    private String label;

    @Column(nullable = false)
    @Builder.Default
    private boolean confirmed = true;

    @Column(name = "confirmed_at", nullable = false)
    @Builder.Default
    private LocalDateTime confirmedAt = LocalDateTime.now();

    @Column(name = "revoked_at")
    private LocalDateTime revokedAt;
}
