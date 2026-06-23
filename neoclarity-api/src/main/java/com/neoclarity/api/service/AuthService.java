package com.neoclarity.api.service;

import com.neoclarity.api.dto.*;
import com.neoclarity.api.exception.ApiException;
import com.neoclarity.api.model.Customer;
import com.neoclarity.api.repository.CustomerRepository;
import com.neoclarity.api.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final CustomerRepository customerRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;

    @Value("${jwt.expiration-ms}")
    private long jwtExpirationMs;

    /**
     * Short-lived store: mfaToken -> customer email, issued after password check passes.
     * MVP only — in-memory is fine for a single-instance demo. Phase 2: Redis with TTL.
     */
    private final Map<String, String> pendingMfaTokens = new ConcurrentHashMap<>();

    public AuthResponse register(RegisterRequest req) {
        if (customerRepository.existsByEmail(req.email())) {
            throw new ApiException(HttpStatus.CONFLICT, "An account with this email already exists");
        }

        Customer customer = Customer.builder()
                .email(req.email().toLowerCase().trim())
                .passwordHash(passwordEncoder.encode(req.password()))
                .firstName(req.firstName())
                .lastName(req.lastName())
                .hashedId(sha256(req.email().toLowerCase().trim() + ":" + UUID.randomUUID()))
                .mfaEnabled(true)
                .consentActive(false)
                .build();

        customer = customerRepository.save(customer);

        String token = jwtTokenProvider.generateToken(customer.getEmail(), customer.getHashedId(), customer.getId());
        return AuthResponse.bearer(token, jwtExpirationMs, CustomerSummary.from(customer));
    }

    /**
     * Step 1 of login. Validates credentials. If MFA is enabled (default true for MVP),
     * returns an MfaRequiredResponse instead of a token — caller must then call verifyMfa().
     */
    public Object login(LoginRequest req) {
        Customer customer = customerRepository.findByEmail(req.email().toLowerCase().trim())
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Invalid email or password"));

        if (!passwordEncoder.matches(req.password(), customer.getPasswordHash())) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Invalid email or password");
        }

        if (customer.isMfaEnabled()) {
            String mfaToken = UUID.randomUUID().toString();
            pendingMfaTokens.put(mfaToken, customer.getEmail());

            return MfaRequiredResponse.builder()
                    .mfaRequired(true)
                    .mfaToken(mfaToken)
                    // MVP: simulated MFA per frozen architecture Section 2.1 — code is shown for demo purposes
                    .demoHint("Demo MFA code: " + customer.getMfaDemoCode())
                    .build();
        }

        String token = jwtTokenProvider.generateToken(customer.getEmail(), customer.getHashedId(), customer.getId());
        return AuthResponse.bearer(token, jwtExpirationMs, CustomerSummary.from(customer));
    }

    /** Step 2 of login — verify the simulated MFA code and issue the JWT. */
    public AuthResponse verifyMfa(MfaVerifyRequest req) {
        String email = pendingMfaTokens.get(req.mfaToken());
        if (email == null) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "MFA session expired or invalid — please log in again");
        }

        Customer customer = customerRepository.findByEmail(email)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Account not found"));

        if (!customer.getMfaDemoCode().equals(req.code())) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Invalid MFA code");
        }

        // Single-use token
        pendingMfaTokens.remove(req.mfaToken());

        String token = jwtTokenProvider.generateToken(customer.getEmail(), customer.getHashedId(), customer.getId());
        return AuthResponse.bearer(token, jwtExpirationMs, CustomerSummary.from(customer));
    }

    public void updateConsent(Customer customer, boolean active) {
        customer.setConsentActive(active);
        if (active) {
            customer.setConsentGrantedAt(LocalDateTime.now());
            customer.setConsentRevokedAt(null);
        } else {
            customer.setConsentRevokedAt(LocalDateTime.now());
        }
        customerRepository.save(customer);
        // NOTE: Section 6 — mirror consent_active to Neo4j Customer node via FastAPI/agent
        // sync hook in Week 5. Agents check consent_active before every Twin read.
    }

    private static String sha256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }
}
