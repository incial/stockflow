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
        try {
            // Check if Google Client ID is configured
            if (googleClientId == null || googleClientId.trim().isEmpty()) {
                throw new UnauthorizedException("AUTH_003", "Google authentication is not properly configured. Please contact the administrator.");
            }

            // Verify Google ID token with timeout protection
            GoogleIdTokenVerifier verifier = new GoogleIdTokenVerifier.Builder(
                    new NetHttpTransport(),
                    GsonFactory.getDefaultInstance())
                    .setAudience(Collections.singletonList(googleClientId))
                    .build();

            GoogleIdToken idToken = null;
            try {
                long startTime = System.currentTimeMillis();
                idToken = verifier.verify(request.getCredential());
                long duration = System.currentTimeMillis() - startTime;
            } catch (java.net.SocketTimeoutException e) {
                throw new RuntimeException("Network timeout while verifying Google token. Please check your internet connection and try again.");
            } catch (java.net.UnknownHostException e) {
                throw new RuntimeException("Cannot reach Google authentication servers. Please check network connectivity.");
            } catch (javax.net.ssl.SSLException e) {
                throw new RuntimeException("SSL certificate error during Google authentication. Please contact system administrator.");
            } catch (IOException e) {
                throw new RuntimeException("Network error during Google authentication: " + e.getMessage());
            }

            if (idToken == null) {
                throw new UnauthorizedException("AUTH_004", "Invalid Google ID token. Please try logging in again.");
            }

            GoogleIdToken.Payload payload = idToken.getPayload();
            String googleId = payload.getSubject();
            String email = payload.getEmail();
            String name = (String) payload.get("name");
            String pictureUrl = (String) payload.get("picture");

            // Find user by email - user must be pre-registered
            User user = userRepository.findByEmail(email).orElseThrow(
                    () -> {
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

            return LoginResponse.builder()
                    .token(token)
                    .user(userResponse)
                    .build();

        } catch (GeneralSecurityException e) {
            throw new RuntimeException("Google token verification failed: " + e.getMessage());
        }
    }
}
