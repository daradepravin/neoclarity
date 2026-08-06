package com.neoclarity.api.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.neoclarity.api.model.Customer;
import com.neoclarity.api.model.Recommendation;
import com.neoclarity.api.model.ResilienceScore;
import com.neoclarity.api.repository.CustomerRepository;
import com.neoclarity.api.repository.RecommendationRepository;
import com.neoclarity.api.repository.ResilienceScoreRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Calls POST /api/agent/analyze on the FastAPI LangGraph agent layer.
 *
 * Returns a Mono<JsonNode> — Spring Boot fires this reactively and does
 * not block the HTTP response thread. On timeout or error, logs a warning
 * and returns null (graceful degradation per frozen architecture NFR).
 *
 * Also persists agent results (Resilience Score + Recommendations) back
 * to PostgreSQL so the dashboard endpoints serve live data.
 */
@Slf4j
@Service
public class AgentService {

    private final WebClient webClient;
    private final long timeoutMs;
    private final CustomerRepository customerRepository;
    private final ResilienceScoreRepository resilienceScoreRepository;
    private final RecommendationRepository recommendationRepository;

    public AgentService(
        @Value("${agent.base-url:http://localhost:8000}") String baseUrl,
        @Value("${agent.timeout-ms:12000}") long timeoutMs,
        @Value("${agent.shared-secret:}") String sharedSecret,
        CustomerRepository customerRepository,
        ResilienceScoreRepository resilienceScoreRepository,
        RecommendationRepository recommendationRepository
    ) {
        this.webClient = WebClient.builder()
            .baseUrl(baseUrl)
            .codecs(c -> c.defaultCodecs().maxInMemorySize(1024 * 1024))
            .build();
        this.timeoutMs = timeoutMs;
        this.sharedSecret = sharedSecret;
        this.customerRepository = customerRepository;
        this.resilienceScoreRepository = resilienceScoreRepository;
        this.recommendationRepository = recommendationRepository;
    }

    private final String sharedSecret;

    public Mono<JsonNode> analyze(String customerHashedId, String trigger) {
        var body = Map.of(
            "customer_hashed_id", customerHashedId,
            "trigger", trigger
        );

        return webClient.post()
            .uri("/api/agent/analyze")
            .contentType(MediaType.APPLICATION_JSON)
            .headers(h -> { if (sharedSecret != null && !sharedSecret.isBlank()) h.add("X-Agent-Secret", sharedSecret); })
            .bodyValue(body)
            .retrieve()
            .bodyToMono(JsonNode.class)
            .timeout(Duration.ofMillis(timeoutMs))
            .doOnSuccess(r -> log.info("agent.analyze_ok hid={}", customerHashedId.substring(0, 8)))
            .onErrorResume(e -> {
                log.warn("agent.analyze_fail hid={} err={}", customerHashedId.substring(0, 8), e.getMessage());
                return Mono.empty();
            });
    }

    /**
     * Persist agent results to PostgreSQL.
     * Called in doOnSuccess after analyze() completes.
     * Wrapped in try/catch — agent results must never crash the API.
     */
    public void persistAnalysisResults(String customerHashedId, JsonNode result) {
        if (result == null) return;

        try {
            Optional<Customer> customerOpt = customerRepository.findByHashedId(customerHashedId);
            if (customerOpt.isEmpty()) {
                log.warn("agent.persist_no_customer hid={}", customerHashedId.substring(0, 8));
                return;
            }
            Customer customer = customerOpt.get();

            // ── Persist Resilience Score ──────────────────────────────────
            JsonNode scoreNode = result.get("resilience_score");
            if (scoreNode != null && !scoreNode.isNull()) {
                JsonNode components = scoreNode.path("components");
                ResilienceScore score = ResilienceScore.builder()
                    .scoreId(UUID.randomUUID().toString())
                    .customer(customer)
                    .overallScore(scoreNode.path("overall").asInt(0))
                    .emergencyFundScore(components.path("emergency_fund").asInt(0))
                    .cashFlowScore(components.path("cash_flow").asInt(0))
                    .debtBurdenScore(components.path("debt_burden").asInt(0))
                    .incomeStabilityScore(components.path("income_stability").asInt(0))
                    .goalReadinessScore(components.path("goal_readiness").asInt(0))
                    .triggeredBy("REFRESH")
                    .build();
                resilienceScoreRepository.save(score);
                log.info("agent.score_persisted overall={}", score.getOverallScore());
            }

            // ── Persist Recommendations (with dedupe) ─────────────────────
            JsonNode recs = result.get("recommendations");
            if (recs != null && recs.isArray()) {
                for (JsonNode rec : recs) {
                    String recId = rec.path("recommendation_id").asText("");
                    if (recId.isEmpty() || recommendationRepository.findByRecommendationIdAndCustomerId(
                            recId, customer.getId()).isPresent()) {
                        continue;
                    }

                    String agent = rec.path("agent").asText("SupervisorAgent");
                    String recText = rec.path("recommendation_text").asText("");

                    // DEDUPE: supersede older PENDING recommendations from the same
                    // agent with near-identical text — prevents pile-up across syncs.
                    recommendationRepository
                        .findByCustomerIdAndResponse(customer.getId(), "PENDING")
                        .stream()
                        .filter(existing -> existing.getAgent().equals(agent)
                                && similarText(existing.getRecommendationText(), recText))
                        .forEach(existing -> {
                            existing.setResponse("SUPERSEDED");
                            existing.setRespondedAt(java.time.LocalDateTime.now());
                            recommendationRepository.save(existing);
                        });

                    Recommendation recommendation = Recommendation.builder()
                        .recommendationId(recId)
                        .customer(customer)
                        .agent(agent)
                        .priority(rec.path("priority").asText("MEDIUM"))
                        .reason(rec.path("reason").asText(""))
                        .recommendationText(recText)
                        .expectedImpact(rec.path("expected_impact").asText(""))
                        .confidence(BigDecimal.valueOf(rec.path("confidence").asDouble(0.7)))
                        .requiresApproval(rec.path("requires_approval").asBoolean(true))
                        .sessionId(rec.path("session_id").asText(""))
                        .response("PENDING")
                        .build();

                    recommendationRepository.save(recommendation);
                }
                log.info("agent.recs_persisted count={}", recs.size());
            }

        } catch (Exception e) {
            log.error("agent.persist_error hid={} err={}", customerHashedId.substring(0, 8), e.getMessage());
        }
    }

    /**
     * Loose text similarity for dedupe — same first 4 significant words.
     * "Increase monthly College Fund contribution" matches
     * "Increase monthly College Fund contributions by $50".
     */
    private boolean similarText(String a, String b) {
        if (a == null || b == null) return false;
        String[] wa = a.toLowerCase().replaceAll("[^a-z0-9 ]", "").split("\\s+");
        String[] wb = b.toLowerCase().replaceAll("[^a-z0-9 ]", "").split("\\s+");
        int n = Math.min(4, Math.min(wa.length, wb.length));
        for (int i = 0; i < n; i++) {
            if (!wa[i].equals(wb[i])) return false;
        }
        return n > 0;
    }
}
