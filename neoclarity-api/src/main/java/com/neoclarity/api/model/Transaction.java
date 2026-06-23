package com.neoclarity.api.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "transactions")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Transaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "transaction_id", nullable = false, unique = true, length = 64)
    private String transactionId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "account_id", nullable = false)
    private Account account;

    /** Positive = credit, negative = debit */
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Column(name = "merchant_raw", nullable = false)
    private String merchantRaw;

    @Column(name = "merchant_normalised")
    private String merchantNormalised;

    @Column(length = 50)
    private String category;

    @Column(length = 50)
    private String subcategory;

    @Column(name = "transaction_date", nullable = false)
    private LocalDate transactionDate;

    @Column(name = "is_recurring", nullable = false)
    @Builder.Default
    private boolean recurring = false;

    @Column(name = "income_flag", nullable = false)
    @Builder.Default
    private boolean incomeFlag = false;

    @Column(precision = 3, scale = 2)
    @Builder.Default
    private BigDecimal confidence = BigDecimal.ONE;

    /** Flips true once the embedding has been written to Neo4j (vector index). */
    @Column(name = "neo4j_synced", nullable = false)
    @Builder.Default
    private boolean neo4jSynced = false;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
