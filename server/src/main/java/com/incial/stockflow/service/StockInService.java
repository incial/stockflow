package com.incial.stockflow.service;

import com.incial.stockflow.dto.request.StockInBatchRequest;
import com.incial.stockflow.dto.request.StockInItemRequest;
import com.incial.stockflow.entity.*;
import com.incial.stockflow.exception.BusinessException;
import com.incial.stockflow.exception.ForbiddenException;
import com.incial.stockflow.repository.StockEntryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class StockInService {
    
    private final StockEntryRepository stockEntryRepository;
    private final OutletService outletService;
    private final ProductService productService;
    private final AuditService auditService;
    
    public List<StockEntry> getStockEntries(UUID outletId, User currentUser) {
        // REFILLER can only access their outlet
        if (currentUser.getRole() == UserRole.REFILLER) {
            if (currentUser.getOutlet() == null) {
                throw new ForbiddenException("User has no outlet assigned");
            }
            return stockEntryRepository.findByOutletIdOrderByEntryDateDescCreatedAtDesc(
                    currentUser.getOutlet().getId());
        }
        
        // ADMIN can filter by outlet or see all
        if (outletId != null) {
            return stockEntryRepository.findByOutletIdOrderByEntryDateDescCreatedAtDesc(outletId);
        }
        return stockEntryRepository.findAllByOrderByEntryDateDescCreatedAtDesc();
    }
    
    @Transactional
    public List<StockEntry> addBatch(StockInBatchRequest request, User currentUser) {
        // Validate outlet access
        UUID effectiveOutletId = request.getOutletId();
        if (currentUser.getRole() == UserRole.REFILLER) {
            if (currentUser.getOutlet() == null) {
                throw new ForbiddenException("User has no outlet assigned");
            }
            if (!currentUser.getOutlet().getId().equals(request.getOutletId())) {
                throw new ForbiddenException("You can only add stock to your assigned outlet");
            }
            effectiveOutletId = currentUser.getOutlet().getId();
        }
        
        // Validate outlet exists
        Outlet outlet = outletService.getOutletById(effectiveOutletId);
        
        // Validate date is not in the future
        if (request.getEntryDate().isAfter(LocalDate.now())) {
            throw new BusinessException("VAL_004", "Entry date cannot be in the future");
        }
        
        if (request.getItems().isEmpty()) {
            throw new BusinessException("BIZ_002", "Batch must contain at least one item");
        }
        
        List<StockEntry> entries = new ArrayList<>();
        
        for (StockInItemRequest item : request.getItems()) {
            Product product = productService.getProductById(item.getProductId());
            
            StockEntry entry = StockEntry.builder()
                    .outlet(outlet)
                    .product(product)
                    .quantity(item.getQuantity())
                    .amount(item.getAmount())
                    .entryDate(request.getEntryDate())
                    .enteredBy(currentUser)
                    .build();
            
            entries.add(stockEntryRepository.save(entry));
        }
        
        // Log the action
        auditService.logAction(currentUser, "CREATE_STOCK_IN_BATCH", "StockEntry", null,
                "Created " + entries.size() + " stock in entries for outlet: " + outlet.getName());
        
        return entries;
    }
}
