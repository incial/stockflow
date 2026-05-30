package com.incial.stockflow.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "security.rate-limit")
public class RateLimitProperties {
    private boolean enabled = false;
    private Bucket auth = new Bucket(5, 300);
    private Bucket api = new Bucket(120, 60);

    @Getter
    @Setter
    public static class Bucket {
        private int capacity;
        private int windowSeconds;

        public Bucket() {
        }

        public Bucket(int capacity, int windowSeconds) {
            this.capacity = capacity;
            this.windowSeconds = windowSeconds;
        }
    }
}
