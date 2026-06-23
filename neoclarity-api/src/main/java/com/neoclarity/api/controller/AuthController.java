package com.neoclarity.api.controller;

import com.neoclarity.api.dto.*;
import com.neoclarity.api.model.Customer;
import com.neoclarity.api.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.ok(authService.register(request));
    }

    /**
     * Step 1 of login. Returns either:
     *  - AuthResponse (200) if MFA is disabled, or
     *  - MfaRequiredResponse (200) if MFA must be verified via /verify-mfa
     */
    @PostMapping("/login")
    public ResponseEntity<Object> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @PostMapping("/verify-mfa")
    public ResponseEntity<AuthResponse> verifyMfa(@Valid @RequestBody MfaVerifyRequest request) {
        return ResponseEntity.ok(authService.verifyMfa(request));
    }

    @GetMapping("/me")
    public ResponseEntity<CustomerSummary> me(@AuthenticationPrincipal Customer customer) {
        return ResponseEntity.ok(CustomerSummary.from(customer));
    }

    /** Simulated consent toggle — Section 2.1 of frozen architecture. */
    @PutMapping("/consent")
    public ResponseEntity<CustomerSummary> updateConsent(
            @AuthenticationPrincipal Customer customer,
            @RequestBody ConsentRequest request
    ) {
        authService.updateConsent(customer, request.active());
        return ResponseEntity.ok(CustomerSummary.from(customer));
    }
}
