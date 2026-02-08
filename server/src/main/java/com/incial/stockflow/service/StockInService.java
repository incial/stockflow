package com.incial.stockflow.service;

import com.incial.stockflow.dto.request.StockInBatchRequest;
import com.incial.stockflow.dto.request.StockInItemRequest;
import com.incial.stockflow.dto.response.StockEntryResponse;
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

    // ----------------------------------------------------------------
    // READ API (DTO, not Entity)
    // ----------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<StockEntryResponse> getStockEntries(UUID outletId, User currentUser) {

        List<StockEntry> entries;

        // REFILLER: only their outlet
        if (currentUser.getRole() == UserRole.REFILLER) {
            if (currentUser.getOutlet() == null) {
                throw new ForbiddenException("User has no outlet assigned");
            }

            entries = stockEntryRepository
                    .findByOutletIdOrderByEntryDateDescCreatedAtDesc(
                            currentUser.getOutlet().getId()
                    );
        }
        // ADMIN: filter or all
        else {
            if (outletId != null) {
                entries = stockEntryRepository
                        .findByOutletIdOrderByEntryDateDescCreatedAtDesc(outletId);
            } else {
                entries = stockEntryRepository
                        .findAllByOrderByEntryDateDescCreatedAtDesc();
            }
        }

        return entries.stream()
                .map(this::toResponse)
                .toList();
    }

    // ----------------------------------------------------------------
    // WRITE API (BATCH INSERT)
    // ----------------------------------------------------------------

    @Transactional
    public List<StockEntryResponse> addBatch(
            StockInBatchRequest request,
            User currentUser
    ) {

        // -----------------------------
        // Outlet access validation
        // -----------------------------

        UUID effectiveOutletId = request.getOutletId();

        if (currentUser.getRole() == UserRole.REFILLER) {
            if (currentUser.getOutlet() == null) {
                throw new ForbiddenException("User has no outlet assigned");
            }

            if (!currentUser.getOutlet().getId().equals(request.getOutletId())) {
                throw new ForbiddenException(
                        "You can only add stock to your assigned outlet"
                );
            }

            effectiveOutletId = currentUser.getOutlet().getId();
        }

        Outlet outlet = outletService.getOutletById(effectiveOutletId);

        // -----------------------------
        // Business validations
        // -----------------------------

        if (request.getEntryDate().isAfter(LocalDate.now())) {
            throw new BusinessException(
                    "VAL_004",
                    "Entry date cannot be in the future"
            );
        }

        if (request.getItems() == null || request.getItems().isEmpty()) {
            throw new BusinessException(
                    "BIZ_002",
                    "Batch must contain at least one item"
            );
        }

        // -----------------------------
        // Persist batch
        // -----------------------------

        List<StockEntryResponse> responses = new ArrayList<>();
        UUID batchId = UUID.randomUUID(); // Generate batch ID for this submission

        for (StockInItemRequest item : request.getItems()) {

            Product product = productService.getProductById(item.getProductId());

            StockEntry entry = StockEntry.builder()
                    .outlet(outlet)
                    .product(product)
                    .quantity(item.getQuantity())
                    .amount(item.getAmount())
                    .entryDate(request.getEntryDate())
                    .enteredBy(currentUser)
                    .batchId(batchId)
                    .additionalData(item.getAdditionalData())
                    .build();

            StockEntry saved = stockEntryRepository.save(entry);
            responses.add(toResponse(saved));
        }

        // -----------------------------
        // Audit (AFTER persistence)
        // -----------------------------

        auditService.logAction(
                currentUser,
                "CREATE_STOCK_IN_BATCH",
                "StockEntry",
                null,
                "Created " + responses.size()
                        + " stock entries for outlet: "
                        + outlet.getName()
        );

        return responses;
    }

    // ----------------------------------------------------------------
    // Entity → DTO mapping (single responsibility)
    // ----------------------------------------------------------------

    private StockEntryResponse toResponse(StockEntry entry) {
        return StockEntryResponse.builder()
                .id(entry.getId())
                .outletId(entry.getOutlet().getId())     
                .productId(entry.getProduct().getId())  
                .quantity(entry.getQuantity())
                .amount(entry.getAmount())
                .entryDate(entry.getEntryDate())
                .batchId(entry.getBatchId())
                .additionalData(entry.getAdditionalData())
                .build();
    }
}
