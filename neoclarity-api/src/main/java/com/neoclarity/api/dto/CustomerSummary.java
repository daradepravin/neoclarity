package com.neoclarity.api.dto;

import com.neoclarity.api.model.Customer;
import lombok.Builder;

@Builder
public record CustomerSummary(
        Long id,
        String hashedId,
        String email,
        String firstName,
        String lastName,
        boolean consentActive
) {
    public static CustomerSummary from(Customer c) {
        return CustomerSummary.builder()
                .id(c.getId())
                .hashedId(c.getHashedId())
                .email(c.getEmail())
                .firstName(c.getFirstName())
                .lastName(c.getLastName())
                .consentActive(c.isConsentActive())
                .build();
    }
}
