package com.incial.stockflow.controller;

import com.incial.stockflow.dto.request.ProductRequest;
import com.incial.stockflow.dto.response.ProductResponse;
import com.incial.stockflow.entity.User;
import com.incial.stockflow.service.ProductService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/products")
@RequiredArgsConstructor
public class ProductController {

    private final ProductService productService;

    @GetMapping
    public ResponseEntity<List<ProductResponse>> getAllProducts() {
        List<ProductResponse> products = productService.getAllProducts();
        return ResponseEntity.ok(products);
    }

    @PostMapping
    public ResponseEntity<ProductResponse> createProduct(
            @Valid @RequestBody ProductRequest request,
            @AuthenticationPrincipal User currentUser) {
        ProductResponse product = productService.createProduct(request, currentUser);
        return ResponseEntity.status(HttpStatus.CREATED).body(product);
    }

    @PutMapping("/{id}")
    public ResponseEntity<ProductResponse> updateProduct(
            @PathVariable Long id,
            @Valid @RequestBody ProductRequest request,
            @AuthenticationPrincipal User currentUser) {
        ProductResponse product = productService.updateProduct(id, request, currentUser);
        return ResponseEntity.ok(product);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteProduct(
            @PathVariable Long id,
            @AuthenticationPrincipal User currentUser) {
        productService.deleteProduct(id, currentUser);
        return ResponseEntity.noContent().build();
    }
}
