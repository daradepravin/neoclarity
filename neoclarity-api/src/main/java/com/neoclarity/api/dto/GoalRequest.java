package com.neoclarity.api.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;

public record GoalRequest(
        @NotBlank String goalType,          // EMERGENCY_FUND | VACATION | COLLEGE | DEBT_PAYOFF
        @NotNull @DecimalMin("0.01") BigDecimal targetAmount,
        BigDecimal currentAmount,           // optional, defaults to 0
        BigDecimal monthlyContribution,      // optional, defaults to 0
        LocalDate deadline
) {}
