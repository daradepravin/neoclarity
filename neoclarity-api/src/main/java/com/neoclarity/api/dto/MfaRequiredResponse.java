package com.neoclarity.api.dto;

import lombok.Builder;

/** Returned by /login when credentials are valid but MFA step is required (MVP: simulated). */
@Builder
public record MfaRequiredResponse(
        boolean mfaRequired,
        String mfaToken,
        String demoHint
) {}
