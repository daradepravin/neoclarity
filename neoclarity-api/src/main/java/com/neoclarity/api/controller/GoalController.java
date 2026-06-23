package com.neoclarity.api.controller;

import com.neoclarity.api.dto.GoalRequest;
import com.neoclarity.api.dto.GoalResponse;
import com.neoclarity.api.model.Customer;
import com.neoclarity.api.service.GoalService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/goals")
@RequiredArgsConstructor
public class GoalController {

    private final GoalService goalService;

    @GetMapping
    public ResponseEntity<List<GoalResponse>> getGoals(@AuthenticationPrincipal Customer customer) {
        List<GoalResponse> goals = goalService.getGoalsForCustomer(customer.getId())
                .stream().map(GoalResponse::from).toList();
        return ResponseEntity.ok(goals);
    }

    @PostMapping
    public ResponseEntity<GoalResponse> createGoal(
            @AuthenticationPrincipal Customer customer,
            @Valid @RequestBody GoalRequest request
    ) {
        return ResponseEntity.ok(GoalResponse.from(goalService.createGoal(customer, request)));
    }

    @PutMapping("/{goalId}")
    public ResponseEntity<GoalResponse> updateGoal(
            @AuthenticationPrincipal Customer customer,
            @PathVariable String goalId,
            @RequestBody GoalRequest request
    ) {
        return ResponseEntity.ok(GoalResponse.from(goalService.updateGoal(customer, goalId, request)));
    }

    @PatchMapping("/{goalId}/pause")
    public ResponseEntity<GoalResponse> pauseGoal(
            @AuthenticationPrincipal Customer customer,
            @PathVariable String goalId
    ) {
        return ResponseEntity.ok(GoalResponse.from(goalService.setStatus(customer, goalId, "PAUSED")));
    }

    @PatchMapping("/{goalId}/resume")
    public ResponseEntity<GoalResponse> resumeGoal(
            @AuthenticationPrincipal Customer customer,
            @PathVariable String goalId
    ) {
        return ResponseEntity.ok(GoalResponse.from(goalService.setStatus(customer, goalId, "ACTIVE")));
    }
}
