package com.neoclarity.api.dto;

import com.neoclarity.api.model.Account;
import lombok.Builder;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Builder
public record AccountResponse(
        String accountId,
        String institution,
        String accountType,
        BigDecimal balance,
        String currency,
        boolean active,
        LocalDateTime lastRefreshedAt
) {
    public static AccountResponse from(Account a) {
        return AccountResponse.builder()
                .accountId(a.getAccountId())
                .institution(a.getInstitution())
                .accountType(a.getAccountType())
                .balance(a.getBalance())
                .currency(a.getCurrency())
                .active(a.isActive())
                .lastRefreshedAt(a.getLastRefreshedAt())
                .build();
    }
}
