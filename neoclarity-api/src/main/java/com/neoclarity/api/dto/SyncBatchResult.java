package com.neoclarity.api.dto;

public record SyncBatchResult(
    int batchNumber,
    String batchLabel,
    String narrative,
    int transactionsAdded,
    int previousScore,
    int newScore,
    int scoreDelta,
    String consequenceType,
    String consequenceLabel,
    String consequenceIcon,
    String nextBatchPreview,
    int batchesRemaining,
    boolean analysisComplete
) {}
