package com.incial.stockflow.service;

import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import com.incial.stockflow.dto.request.GoogleLoginRequest;
import com.incial.stockflow.dto.request.LoginRequest;
import com.incial.stockflow.dto.response.LoginResponse;
import com.incial.stockflow.dto.response.UserResponse;
import com.incial.stockflow.entity.User;
import com.incial.stockflow.exception.UnauthorizedException;
import com.incial.stockflow.repository.UserRepository;
import com.incial.stockflow.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.security.GeneralSecurityException;
import java.util.Collections;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil tokenProvider;
    private final AuditService auditService;

    @Value("${google.client.id}")
    private String googleClientId;

    @Transactional
    public LoginResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new UnauthorizedException("AUTH_001", "Invalid email or password"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new UnauthorizedException("AUTH_001", "Invalid email or password");
        }

        String token = tokenProvider.generateToken(user.getId(),user.getEmail(), String.valueOf(user.getRole()));

        // Log the login
        auditService.logAction(user, "LOGIN", "User", user.getId(), "User logged in successfully");

        UserResponse userResponse = UserResponse.builder()
                .id(user.getId())
                .name(user.getName())
                .email(user.getEmail())
                .role(user.getRole())
                .outletId(user.getOutlet() != null ? user.getOutlet().getId() : null)
                .avatarUrl(user.getAvatarUrl())
                .build();

        return LoginResponse.builder()
                .token(token)
                .user(userResponse)
                .build();
    }

    public LoginResponse loginWithGoogle(GoogleLoginRequest request) {
        log.info("Google login attempt starting");
        try {
            // Check if Google Client ID is configured
            if (googleClientId == null || googleClientId.trim().isEmpty()) {
                log.error("Google Client ID not configured");
                throw new UnauthorizedException("AUTH_003", "Google authentication is not properly configured. Please contact the administrator.");
            }

            log.debug("Creating Google ID token verifier");
            // Verify Google ID token with timeout protection
            GoogleIdTokenVerifier verifier = new GoogleIdTokenVerifier.Builder(
                    new NetHttpTransport(),
                    GsonFactory.getDefaultInstance())
                    .setAudience(Collections.singletonList(googleClientId))
                    .build();

            GoogleIdToken idToken = null;
            try {
                log.debug("Verifying Google token - this may involve network I/O to googleapis.com");
                long startTime = System.currentTimeMillis();
                idToken = verifier.verify(request.getCredential());
                long duration = System.currentTimeMillis() - startTime;
                log.info("Google token verification completed in {}ms", duration);
            } catch (java.net.SocketTimeoutException e) {
                log.error("Socket timeout during Google token verification", e);
                throw new RuntimeException("Network timeout while verifying Google token. Please check your internet connection and try again.");
            } catch (java.net.UnknownHostException e) {
                log.error("Unknown host during Google token verification - cannot reach googleapis.com", e);
                throw new RuntimeException("Cannot reach Google authentication servers. Please check network connectivity.");
            } catch (javax.net.ssl.SSLException e) {
                log.error("SSL error during Google token verification", e);
                throw new RuntimeException("SSL certificate error during Google authentication. Please contact system administrator.");
            } catch (IOException e) {
                log.error("IO error during Google token verification", e);
                throw new RuntimeException("Network error during Google authentication: " + e.getMessage());
            }

            if (idToken == null) {
                log.warn("Google token verification returned null - invalid token");
                throw new UnauthorizedException("AUTH_004", "Invalid Google ID token. Please try logging in again.");
            }

            GoogleIdToken.Payload payload = idToken.getPayload();
            String googleId = payload.getSubject();
            String email = payload.getEmail();
            String name = (String) payload.get("name");
            String pictureUrl = (String) payload.get("picture");

            log.info("Google token verified successfully for email: {}", email);

            // Find user by email - user must be pre-registered
            User user = userRepository.findByEmail(email).orElseThrow(
                    () -> {
                        log.warn("Google login attempted for unregistered email: {}", email);
                        return new UnauthorizedException("AUTH_005", "User not associated with this email. Contact sales");
                    }
            );

            // Update existing user with Google info only if values changed
            boolean needsUpdate = false;
            if (user.getGoogleId() == null || !user.getGoogleId().equals(googleId)) {
                user.setGoogleId(googleId);
                needsUpdate = true;
            }
            if (pictureUrl != null && (user.getAvatarUrl() == null || !user.getAvatarUrl().equals(pictureUrl))) {
                user.setAvatarUrl(pictureUrl);
                needsUpdate = true;
            }
            if (needsUpdate) {
                userRepository.save(user);
                log.debug("Updated user Google info for: {}", email);
            }

            String token = tokenProvider.generateToken(user.getId(),user.getEmail(), String.valueOf(user.getRole()));

            // Log the login
            auditService.logAction(user, "GOOGLE LOGIN", "User", user.getId(), "User logged in successfully");

            UserResponse userResponse = UserResponse.builder()
                    .id(user.getId())
                    .name(user.getName())
                    .email(user.getEmail())
                    .role(user.getRole())
                    .outletId(user.getOutlet() != null ? user.getOutlet().getId() : null)
                    .avatarUrl(user.getAvatarUrl())
                    .build();

            log.info("Google login successful for user: {}", email);
            return LoginResponse.builder()
                    .token(token)
                    .user(userResponse)
                    .build();

        } catch (GeneralSecurityException e) {
            log.error("Security exception during Google token verification", e);
            throw new RuntimeException("Google token verification failed: " + e.getMessage());
        }
    }
}
