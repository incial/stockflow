package com.incial.stockflow.service;

import com.incial.stockflow.dto.request.ProductRequest;
import com.incial.stockflow.entity.Product;
import com.incial.stockflow.entity.User;
import com.incial.stockflow.exception.BusinessException;
import com.incial.stockflow.exception.ResourceNotFoundException;
import com.incial.stockflow.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ProductService {
    
    private final ProductRepository productRepository;
    private final AuditService auditService;
    
    public List<Product> getAllProducts() {
        return productRepository.findAllByOrderByBrandAscNameAsc();
    }
    
    public Product getProductById(UUID id) {
        return productRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found with id: " + id));
    }
    
    @Transactional
    public Product createProduct(ProductRequest request, User currentUser) {
        if (productRepository.existsByNameAndBrand(request.getName(), request.getBrand())) {
            throw new BusinessException("RES_002",
                    "Product with name '" + request.getName() + "' and brand '" + request.getBrand() + "' already exists");
        }
        
        Product product = Product.builder()
                .name(request.getName())
                .brand(request.getBrand())
                .mrp(request.getMrp())
                .build();
        
        Product savedProduct = productRepository.save(product);
        
        // Log the action
        auditService.logAction(currentUser, "CREATE_PRODUCT", "Product", savedProduct.getId(),
                "Created product: " + savedProduct.getName() + " (" + savedProduct.getBrand() + ")");
        
        return savedProduct;
    }
}
