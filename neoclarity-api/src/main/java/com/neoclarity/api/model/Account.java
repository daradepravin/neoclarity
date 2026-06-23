package com.neoclarity.api.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "accounts")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Account {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Hashed account identifier — mirrored as Neo4j Account.account_id */
    @Column(name = "account_id", nullable = false, unique = true, length = 64)
    private String accountId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id", nullable = false)
    private Customer customer;

    @Column(nullable = false, length = 100)
    private String institution;

    /** CHECKING | SAVINGS | CREDIT | LOAN */
    @Column(name = "account_type", nullable = false, length = 20)
    private String accountType;

    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal balance;

    @Column(nullable = false, length = 3)
    @Builder.Default
    private String currency = "USD";

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private boolean active = true;

    @Column(name = "linked_at", nullable = false)
    @Builder.Default
    private LocalDateTime linkedAt = LocalDateTime.now();

    @Column(name = "last_refreshed_at", nullable = false)
    @Builder.Default
    private LocalDateTime lastRefreshedAt = LocalDateTime.now();
}
