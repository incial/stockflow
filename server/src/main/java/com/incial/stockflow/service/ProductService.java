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

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
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

    public Map<UUID, Product> getProductsByIds(Collection<UUID> ids) {
        Map<UUID, Product> productsById = new LinkedHashMap<>();
        productRepository.findByIdIn(ids).forEach(product -> productsById.put(product.getId(), product));

        for (UUID id : ids) {
            if (!productsById.containsKey(id)) {
                throw new ResourceNotFoundException("Product not found with id: " + id);
            }
        }

        return productsById;
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

    @Transactional
    public Product updateProduct(UUID id, ProductRequest request, User currentUser) {
        Product product = getProductById(id);

        // Check if updating to a name/brand combo that already exists (excluding current product)
        if (!product.getName().equals(request.getName()) || !product.getBrand().equals(request.getBrand())) {
            if (productRepository.existsByNameAndBrand(request.getName(), request.getBrand())) {
                throw new BusinessException("RES_002",
                        "Product with name '" + request.getName() + "' and brand '" + request.getBrand() + "' already exists");
            }
        }

        product.setName(request.getName());
        product.setBrand(request.getBrand());
        product.setMrp(request.getMrp());

        Product updatedProduct = productRepository.save(product);

        // Log the action
        auditService.logAction(currentUser, "UPDATE_PRODUCT", "Product", updatedProduct.getId(),
                "Updated product: " + updatedProduct.getName() + " (" + updatedProduct.getBrand() + ")");

        return updatedProduct;
    }

    @Transactional
    public void deleteProduct(UUID id, User currentUser) {
        Product product = getProductById(id);

        // Log the action before deletion
        auditService.logAction(currentUser, "DELETE_PRODUCT", "Product", product.getId(),
                "Deleted product: " + product.getName() + " (" + product.getBrand() + ")");

        productRepository.delete(product);
    }
}
