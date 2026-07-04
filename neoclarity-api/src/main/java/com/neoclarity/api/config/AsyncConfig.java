package com.neoclarity.api.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;

/**
 * Enables @Async support so TwinProjectionService methods
 * run in a background thread and don't block the HTTP response.
 */
@Configuration
@EnableAsync
public class AsyncConfig {
}
