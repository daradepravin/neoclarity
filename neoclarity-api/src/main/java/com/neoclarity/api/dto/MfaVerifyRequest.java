package com.neoclarity.api.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * MVP simulated MFA (frozen architecture Section 2.1).
 * mfaToken is the short-lived token returned from /login when MFA is required.
 * code is checked against the customer's static mfa_demo_code.
 */
public record MfaVerifyRequest(
        @NotBlank String mfaToken,
        @NotBlank String code
) {}
