package com.neoclarity.api.dto;

import lombok.Builder;

@Builder
public record AuthResponse(
        String token,
        String tokenType,
        Long expiresInMs,
        CustomerSummary customer
) {
    public static AuthResponse bearer(String jwt, long expiresInMs, CustomerSummary customer) {
        return AuthResponse.builder()
                .token(jwt)
                .tokenType("Bearer")
                .expiresInMs(expiresInMs)
                .customer(customer)
                .build();
    }
}
