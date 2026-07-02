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

@Service
@Slf4j
public class AgentService {

    private final WebClient webClient;
    private final long timeoutMs;
    private final CustomerRepository customerRepository;
    private final ResilienceScoreRepository resilienceScoreRepository;
    private final RecommendationRepository recommendationRepository;

    public AgentService(
        @Value("${agent.base-url}") String baseUrl,
        @Value("${agent.timeout-ms:10000}") long timeoutMs,
        CustomerRepository customerRepository,
        ResilienceScoreRepository resilienceScoreRepository,
        RecommendationRepository recommendationRepository
    ) {
        this.webClient = WebClient.builder()
            .baseUrl(baseUrl)
            .codecs(c -> c.defaultCodecs().maxInMemorySize(1024 * 1024))
            .build();
        this.timeoutMs = timeoutMs;
        this.customerRepository = customerRepository;
        this.resilienceScoreRepository = resilienceScoreRepository;
        this.recommendationRepository = recommendationRepository;
    }

    /**
     * Calls POST /api/agent/analyze on the FastAPI agent layer.
     * On timeout or error, logs a warning and returns null — graceful degradation,
     * Spring Boot continues to serve the last cached data.
     */
    public Mono<JsonNode> analyze(String customerHashedId, String trigger) {
        var body = Map.of(
            "customer_hashed_id", customerHashedId,
            "trigger", trigger
        );
        return webClient.post()
            .uri("/api/agent/analyze")
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue(body)
            .retrieve()
            .bodyToMono(JsonNode.class)
            .timeout(Duration.ofMillis(timeoutMs))
            .doOnSuccess(r -> {
                log.info("agent.analyze_complete hid={}", customerHashedId.substring(0, 8));
                if (r != null) {
                    persistAnalysisResults(customerHashedId, trigger, r);
                }
            })
            .doOnError(e -> log.warn("agent.analyze_failed hid={} err={}", customerHashedId.substring(0, 8), e.getMessage()))
            .onErrorReturn(null);
    }

    private void persistAnalysisResults(String customerHashedId, String trigger, JsonNode result) {
        try {
            Customer customer = customerRepository.findByHashedId(customerHashedId).orElse(null);
            if (customer == null) {
                log.warn("agent.persist_skip customer_not_found hid={}", customerHashedId.substring(0, 8));
                return;
            }

            JsonNode scoreNode = result.get("resilience_score");
            if (scoreNode != null && !scoreNode.isNull()) {
                JsonNode components = scoreNode.get("components");
                ResilienceScore score = ResilienceScore.builder()
                    .customer(customer)
                    .overallScore(scoreNode.path("overall").asInt(0))
                    .emergencyFundScore(components != null ? components.path("emergency_fund").asInt(0) : 0)
                    .cashFlowScore(components != null ? components.path("cash_flow").asInt(0) : 0)
                    .debtBurdenScore(components != null ? components.path("debt_burden").asInt(0) : 0)
                    .incomeStabilityScore(components != null ? components.path("income_stability").asInt(0) : 0)
                    .goalReadinessScore(components != null ? components.path("goal_readiness").asInt(0) : 0)
                    .triggeredBy(trigger)
                    .build();
                resilienceScoreRepository.save(score);
                log.info("agent.score_persisted hid={} score={}", customerHashedId.substring(0, 8), score.getOverallScore());
            }

            JsonNode recs = result.get("recommendations");
            if (recs != null && recs.isArray()) {
                for (JsonNode rec : recs) {
                    // Idempotency: skip if this recommendation_id already persisted
                    String recId = rec.path("recommendation_id").asText("");
                    if (!recId.isEmpty() && recommendationRepository
                            .findByRecommendationIdAndCustomerId(recId, customer.getId()).isPresent()) {
                        continue;
                    }
                    Recommendation recommendation = Recommendation.builder()
                        .customer(customer)
                        .agent(rec.path("agent").asText("SupervisorAgent"))
                        .priority(rec.path("priority").asText("MEDIUM"))
                        .reason(rec.path("reason").asText(""))
                        .recommendationText(rec.path("recommendation_text").asText(""))
                        .expectedImpact(rec.path("expected_impact").asText(""))
                        .confidence(BigDecimal.valueOf(rec.path("confidence").asDouble(0.7)))
                        .requiresApproval(rec.path("requires_approval").asBoolean(true))
                        .sessionId(rec.path("session_id").asText(""))
                        .response("PENDING")
                        .build();
                    recommendationRepository.save(recommendation);
                }
                log.info("agent.recs_persisted hid={} count={}", customerHashedId.substring(0, 8), recs.size());
            }
        } catch (Exception e) {
            log.warn("agent.persist_failed hid={} err={}", customerHashedId.substring(0, 8), e.getMessage());
        }
    }
}