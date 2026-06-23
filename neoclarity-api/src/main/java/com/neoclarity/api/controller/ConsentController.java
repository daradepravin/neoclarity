package com.neoclarity.api.controller;

import com.neoclarity.api.model.Customer;
import com.neoclarity.api.service.ConsentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * Privacy / data-lifecycle controller.
 *
 * Delete My Data (FR-2.4) is intentionally isolated on its own controller and
 * requires the customer to type a confirmation phrase, client-side, before the
 * UI will call it. This is the explicit "right to be forgotten" action.
 */
@RestController
@RequestMapping("/api/consent")
@RequiredArgsConstructor
public class ConsentController {

    private final ConsentService consentService;

    @DeleteMapping("/my-data")
    public ResponseEntity<ConsentService.DeleteResult> deleteMyData(
            @AuthenticationPrincipal Customer customer,
            @RequestParam(name = "confirm", required = false) String confirm
    ) {
        // Server-side guard in addition to the client-side typed confirmation.
        if (!"DELETE".equalsIgnoreCase(confirm)) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }
        return ResponseEntity.ok(consentService.deleteMyData(customer));
    }
}
