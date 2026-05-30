package com.incial.stockflow.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.incial.stockflow.config.RateLimitProperties;
import com.incial.stockflow.dto.response.ErrorResponse;
import com.incial.stockflow.entity.User;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
@RequiredArgsConstructor
public class RateLimitingFilter extends OncePerRequestFilter {
    private static final String API_PREFIX = "/api/v1/";
    private static final String AUTH_PREFIX = "/api/v1/auth/";

    private final RateLimitProperties rateLimitProperties;
    private final ObjectMapper objectMapper;
    private final Map<String, WindowCounter> counters = new ConcurrentHashMap<>();

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if (!rateLimitProperties.isEnabled()) {
            return true;
        }

        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }

        String path = request.getServletPath();
        return path == null || !path.startsWith(API_PREFIX);
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        long now = System.currentTimeMillis();
        cleanupStaleEntries(now);

        String path = request.getServletPath();
        boolean authRequest = path.startsWith(AUTH_PREFIX);
        RateLimitProperties.Bucket bucket = authRequest
                ? rateLimitProperties.getAuth()
                : rateLimitProperties.getApi();

        String key = buildKey(request, authRequest);
        RateLimitDecision decision = tryAcquire(key, bucket, now);

        response.setHeader("X-RateLimit-Limit", String.valueOf(bucket.getCapacity()));
        response.setHeader("X-RateLimit-Remaining", String.valueOf(decision.remaining()));
        response.setHeader("X-RateLimit-Reset", String.valueOf(decision.resetEpochSeconds()));

        if (!decision.allowed()) {
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.setCharacterEncoding("UTF-8");
            response.setHeader("Retry-After", String.valueOf(decision.retryAfterSeconds()));
            objectMapper.writeValue(
                    response.getWriter(),
                    ErrorResponse.builder()
                            .status(HttpStatus.TOO_MANY_REQUESTS.value())
                            .error(HttpStatus.TOO_MANY_REQUESTS.getReasonPhrase())
                            .message(authRequest
                                    ? "Too many authentication attempts. Please try again later."
                                    : "Too many requests. Please slow down and try again shortly.")
                            .timestamp(LocalDateTime.now())
                            .path(request.getRequestURI())
                            .build()
            );
            return;
        }

        filterChain.doFilter(request, response);
    }

    private String buildKey(HttpServletRequest request, boolean authRequest) {
        String scope = authRequest ? "auth" : "api";
        if (!authRequest) {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication != null && authentication.isAuthenticated() && authentication.getPrincipal() instanceof User user) {
                return scope + ":user:" + user.getId();
            }
        }

        return scope + ":ip:" + resolveClientIp(request);
    }

    private String resolveClientIp(HttpServletRequest request) {
        String forwardedFor = request.getHeader("X-Forwarded-For");
        if (forwardedFor != null && !forwardedFor.isBlank()) {
            return forwardedFor.split(",")[0].trim();
        }

        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) {
            return realIp.trim();
        }

        return request.getRemoteAddr();
    }

    private RateLimitDecision tryAcquire(String key, RateLimitProperties.Bucket bucket, long now) {
        long windowMillis = Math.max(bucket.getWindowSeconds(), 1) * 1000L;
        WindowCounter counter = counters.compute(key, (ignored, existing) -> {
            if (existing == null || now >= existing.windowStartMillis + windowMillis) {
                return new WindowCounter(now, 1, now);
            }

            existing.requestCount++;
            existing.lastSeenMillis = now;
            return existing;
        });

        long resetAtMillis = counter.windowStartMillis + windowMillis;
        if (counter.requestCount <= bucket.getCapacity()) {
            return new RateLimitDecision(
                    true,
                    Math.max(bucket.getCapacity() - counter.requestCount, 0),
                    Math.max((resetAtMillis - now + 999) / 1000, 1),
                    resetAtMillis / 1000
            );
        }

        return new RateLimitDecision(
                false,
                0,
                Math.max((resetAtMillis - now + 999) / 1000, 1),
                resetAtMillis / 1000
        );
    }

    private void cleanupStaleEntries(long now) {
        long maxWindowMillis = Math.max(
                Math.max(rateLimitProperties.getAuth().getWindowSeconds(), rateLimitProperties.getApi().getWindowSeconds()),
                1
        ) * 1000L;
        long staleBefore = now - (maxWindowMillis * 2);
        counters.entrySet().removeIf(entry -> entry.getValue().lastSeenMillis < staleBefore);
    }

    private record RateLimitDecision(
            boolean allowed,
            int remaining,
            long retryAfterSeconds,
            long resetEpochSeconds
    ) {
    }

    private static final class WindowCounter {
        private final long windowStartMillis;
        private int requestCount;
        private long lastSeenMillis;

        private WindowCounter(long windowStartMillis, int requestCount, long lastSeenMillis) {
            this.windowStartMillis = windowStartMillis;
            this.requestCount = requestCount;
            this.lastSeenMillis = lastSeenMillis;
        }
    }
}
