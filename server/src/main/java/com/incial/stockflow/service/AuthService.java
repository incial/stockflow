package com.incial.stockflow.service;

import com.incial.stockflow.dto.request.LoginRequest;
import com.incial.stockflow.dto.response.LoginResponse;
import com.incial.stockflow.dto.response.UserResponse;
import com.incial.stockflow.entity.User;
import com.incial.stockflow.exception.UnauthorizedException;
import com.incial.stockflow.repository.UserRepository;
import com.incial.stockflow.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthService {
    
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil tokenProvider;
    private final AuditService auditService;
    
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
                .build();
        
        return LoginResponse.builder()
                .token(token)
                .user(userResponse)
                .build();
    }
}
