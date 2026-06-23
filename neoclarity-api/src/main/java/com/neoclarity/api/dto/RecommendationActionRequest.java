package com.neoclarity.api.dto;

import jakarta.validation.constraints.Pattern;

/** APPROVED | DISMISSED | REMIND_LATER */
public record RecommendationActionRequest(
        @Pattern(regexp = "APPROVED|DISMISSED|REMIND_LATER") String response
) {}
