package com.incial.stockflow.service;

import com.incial.stockflow.dto.request.StockOutBatchRequest;
import com.incial.stockflow.dto.request.StockOutItemRequest;
import com.incial.stockflow.entity.*;
import com.incial.stockflow.exception.BusinessException;
import com.incial.stockflow.exception.ForbiddenException;
import com.incial.stockflow.repository.StockEntryRepository;
import com.incial.stockflow.repository.StockOutEntryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class StockOutService {
    
    private final StockOutEntryRepository stockOutEntryRepository;
    private final StockEntryRepository stockEntryRepository;
    private final OutletService outletService;
    private final ProductService productService;
    private final AuditService auditService;
    
    public List<StockOutEntry> getStockOutEntries(UUID outletId, User currentUser) {
        // REFILLER can only access their outlet
        if (currentUser.getRole() == UserRole.REFILLER) {
            if (currentUser.getOutlet() == null) {
                throw new ForbiddenException("User has no outlet assigned");
            }
            return stockOutEntryRepository.findByOutletIdOrderByDateDescCreatedAtDesc(
                    currentUser.getOutlet().getId());
        }
        
        // ADMIN can filter by outlet or see all
        if (outletId != null) {
            return stockOutEntryRepository.findByOutletIdOrderByDateDescCreatedAtDesc(outletId);
        }
        return stockOutEntryRepository.findAllByOrderByDateDescCreatedAtDesc();
    }
    
    @Transactional
    public List<StockOutEntry> addBatch(StockOutBatchRequest request, User currentUser) {
        // Validate outlet access
        UUID effectiveOutletId = request.getOutletId();
        if (currentUser.getRole() == UserRole.REFILLER) {
            if (currentUser.getOutlet() == null) {
                throw new ForbiddenException("User has no outlet assigned");
            }
            if (!currentUser.getOutlet().getId().equals(request.getOutletId())) {
                throw new ForbiddenException("You can only record stock out for your assigned outlet");
            }
            effectiveOutletId = currentUser.getOutlet().getId();
        }
        
        // Validate outlet exists
        Outlet outlet = outletService.getOutletById(effectiveOutletId);
        
        // Validate date is not in the future
        if (request.getEntryDate().isAfter(LocalDate.now())) {
            throw new BusinessException("VAL_004", "Date cannot be in the future");
        }
        
        if (request.getItems().isEmpty()) {
            throw new BusinessException("BIZ_002", "Batch must contain at least one item");
        }
        
        List<StockOutEntry> entries = new ArrayList<>();
        
        for (StockOutItemRequest item : request.getItems()) {
            Product product = productService.getProductById(item.getProductId());
            
            // Validate stock availability
            int availableStock = calculateAvailableStock(effectiveOutletId, item.getProductId());
            if (availableStock < item.getQuantity()) {
                Map<String, String> details = new HashMap<>();
                details.put("available", String.valueOf(availableStock));
                details.put("requested", String.valueOf(item.getQuantity()));
                details.put("productId", item.getProductId().toString());
                
                throw new BusinessException("BIZ_001",
                        "Insufficient stock for product '" + product.getName() + "' at outlet '" + outlet.getName() + "'",
                        details);
            }
            
            // Validate reason
            StockOutReason reason;
            try {
                reason = StockOutReason.valueOf(item.getReason());
            } catch (IllegalArgumentException e) {
                throw new BusinessException("BIZ_003",
                        "Invalid stock out reason. Allowed values: Sale, Damage, Expiry, Return, Other");
            }
            
            StockOutEntry entry = StockOutEntry.builder()
                    .outlet(outlet)
                    .product(product)
                    .quantity(item.getQuantity())
                    .date(request.getEntryDate())
                    .reason(reason)
                    .enteredBy(currentUser)
                    .build();
            
            entries.add(stockOutEntryRepository.save(entry));
        }
        
        // Log the action
        auditService.logAction(currentUser, "CREATE_STOCK_OUT_BATCH", "StockOutEntry", null,
                "Created " + entries.size() + " stock out entries for outlet: " + outlet.getName());
        
        return entries;
    }
    
    private int calculateAvailableStock(UUID outletId, UUID productId) {
        List<StockEntry> stockIns = stockEntryRepository.findByOutletIdOrderByEntryDateDescCreatedAtDesc(outletId);
        List<StockOutEntry> stockOuts = stockOutEntryRepository.findByOutletIdOrderByDateDescCreatedAtDesc(outletId);
        
        int totalIn = stockIns.stream()
                .filter(e -> e.getProduct().getId().equals(productId))
                .mapToInt(StockEntry::getQuantity)
                .sum();
        
        int totalOut = stockOuts.stream()
                .filter(e -> e.getProduct().getId().equals(productId))
                .mapToInt(StockOutEntry::getQuantity)
                .sum();
        
        return totalIn - totalOut;
    }
}
