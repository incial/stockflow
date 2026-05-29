package com.incial.stockflow.service;

import com.incial.stockflow.dto.request.BatchUpdateRequest;
import com.incial.stockflow.dto.request.StockInBatchRequest;
import com.incial.stockflow.dto.request.StockInItemRequest;
import com.incial.stockflow.dto.response.StockEntryResponse;
import com.incial.stockflow.entity.*;
import com.incial.stockflow.exception.BusinessException;
import com.incial.stockflow.exception.ForbiddenException;
import com.incial.stockflow.repository.BatchReferenceRepository;
import com.incial.stockflow.repository.StockEntryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class StockInService {
    private static final int DEFAULT_PAGE_SIZE = 200;
    private static final int MAX_PAGE_SIZE = 500;

    private final StockEntryRepository stockEntryRepository;
    private final BatchReferenceRepository batchReferenceRepository;
    private final OutletService outletService;
    private final ProductService productService;
    private final AuditService auditService;

    // ----------------------------------------------------------------
    // READ API (DTO, not Entity)
    // ----------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<StockEntryResponse> getStockEntries(Long outletId, Integer page, Integer size, User currentUser) {
        Pageable pageable = PageRequest.of(
                Math.max(page != null ? page : 0, 0),
                Math.min(Math.max(size != null ? size : DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE)
        );

        List<StockEntry> entries;

        // REFILLER: only their outlet
        if (currentUser.getRole() == UserRole.REFILLER) {
            if (currentUser.getOutlet() == null) {
                throw new ForbiddenException("User has no outlet assigned");
            }

            entries = stockEntryRepository
                    .findByOutletIdOrderByEntryDateDescCreatedAtDesc(
                            currentUser.getOutlet().getId(),
                            pageable
                    );
        }
        // ADMIN: filter or all
        else {
            if (outletId != null) {
                entries = stockEntryRepository
                        .findByOutletIdOrderByEntryDateDescCreatedAtDesc(outletId, pageable);
            } else {
                entries = stockEntryRepository
                        .findAllByOrderByEntryDateDescCreatedAtDesc(pageable);
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

        Long effectiveOutletId = request.getOutletId();

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

        List<Long> productIds = request.getItems().stream()
                .map(StockInItemRequest::getProductId)
                .distinct()
                .toList();
        Map<Long, Product> productsById = productService.getProductsByIds(productIds);

        List<StockEntry> entriesToSave = new ArrayList<>();
        List<StockEntryResponse> responses = new ArrayList<>();
        Long batchId = reserveBatchId();

        for (StockInItemRequest item : request.getItems()) {
            Product product = productsById.get(item.getProductId());

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

            entriesToSave.add(entry);
        }

        stockEntryRepository.saveAll(entriesToSave);
        responses = entriesToSave.stream()
                .map(this::toResponse)
                .toList();

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

        int updatedCount = stockEntryRepository.updateBatchMetadata(
                request.getBatchId(),
                request.getBatchName(),
                request.getIsChecked()
        );

        if (updatedCount == 0) {
            throw new BusinessException(
                    "BIZ_003",
                    "No entries found with batch ID: " + request.getBatchId()
            );
        }

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
    public void deleteBatch(Long batchId, User currentUser) {
        // Only ADMIN can delete batches
        if (currentUser.getRole() != UserRole.ADMIN) {
            throw new ForbiddenException("Only administrators can delete batches");
        }

        StockEntryRepository.BatchSummary batchSummary =
                stockEntryRepository.findBatchSummaryByBatchId(batchId);

        if (batchSummary == null || batchSummary.getEntryCount() == 0) {
            throw new BusinessException(
                    "BIZ_004",
                    "No entries found with batch ID: " + batchId
            );
        }

        // Get batch info for audit log
        long entryCount = batchSummary.getEntryCount();
        String outletName = batchSummary.getOutletName();
        String batchName = batchSummary.getBatchName();

        // Delete all entries in the batch
        stockEntryRepository.deleteByBatchId(batchId);

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

    private Long reserveBatchId() {
        return batchReferenceRepository.save(BatchReference.builder().build()).getId();
    }
}
