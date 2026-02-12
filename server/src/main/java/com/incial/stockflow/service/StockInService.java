package com.incial.stockflow.service;

import com.incial.stockflow.dto.request.BatchUpdateRequest;
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
    // UPDATE BATCH API
    // ----------------------------------------------------------------

    @Transactional
    public void updateBatch(BatchUpdateRequest request, User currentUser) {
        // Only ADMIN can update batch metadata
        if (currentUser.getRole() != UserRole.ADMIN) {
            throw new ForbiddenException("Only administrators can update batch information");
        }

        // Find all entries with the given batchId
        List<StockEntry> entries = stockEntryRepository.findByBatchId(request.getBatchId());
        
        if (entries.isEmpty()) {
            throw new BusinessException(
                    "BIZ_003",
                    "No entries found with batch ID: " + request.getBatchId()
            );
        }

        // Update all entries in the batch
        entries.forEach(entry -> {
            if (request.getBatchName() != null) {
                entry.setBatchName(request.getBatchName());
            }
            if (request.getIsChecked() != null) {
                entry.setIsChecked(request.getIsChecked());
            }
        });

        stockEntryRepository.saveAll(entries);

        // Audit
        auditService.logAction(
                currentUser,
                "UPDATE_BATCH",
                "StockEntry",
                null,
                "Updated batch: name=" + request.getBatchName() + 
                ", checked=" + request.getIsChecked()
        );
    }

    // ----------------------------------------------------------------
    // DELETE BATCH API
    // ----------------------------------------------------------------

    @Transactional
    public void deleteBatch(UUID batchId, User currentUser) {
        // Only ADMIN can delete batches
        if (currentUser.getRole() != UserRole.ADMIN) {
            throw new ForbiddenException("Only administrators can delete batches");
        }

        // Find all entries with the given batchId
        List<StockEntry> entries = stockEntryRepository.findByBatchId(batchId);
        
        if (entries.isEmpty()) {
            throw new BusinessException(
                    "BIZ_004",
                    "No entries found with batch ID: " + batchId
            );
        }

        // Get batch info for audit log
        int entryCount = entries.size();
        String outletName = entries.get(0).getOutlet().getName();
        String batchName = entries.get(0).getBatchName();

        // Delete all entries in the batch
        stockEntryRepository.deleteAll(entries);

        // Audit
        auditService.logAction(
                currentUser,
                "DELETE_BATCH",
                "StockEntry",
               null,
                "Deleted batch '" + (batchName != null ? batchName : "unnamed") + 
                "' with " + entryCount + " entries from outlet: " + outletName
        );
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
                .batchName(entry.getBatchName())
                .isChecked(entry.getIsChecked())
                .additionalData(entry.getAdditionalData())
                .build();
    }
}
