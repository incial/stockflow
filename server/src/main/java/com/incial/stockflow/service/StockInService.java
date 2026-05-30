package com.incial.stockflow.service;

import com.incial.stockflow.dto.request.BatchUpdateRequest;
import com.incial.stockflow.dto.request.RefillerStockEntryUpdateRequest;
import com.incial.stockflow.dto.request.StockInBatchRequest;
import com.incial.stockflow.dto.request.StockInItemRequest;
import com.incial.stockflow.dto.response.RefillerReportsResponse;
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

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class StockInService {
    private static final int DEFAULT_PAGE_SIZE = 200;
    private static final int MAX_PAGE_SIZE = 500;
    private static final int MAX_REFILLER_EDITABLE_BATCHES = 5;

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

    @Transactional(readOnly = true)
    public RefillerReportsResponse getRefillerReports(User currentUser, String date) {
        Outlet outlet = requireRefillerOutlet(currentUser);
        List<StockEntryRepository.LatestBatchInfo> latestBatchInfos = stockEntryRepository.findLatestBatchInfosByOutletId(
                outlet.getId(),
                PageRequest.of(0, MAX_REFILLER_EDITABLE_BATCHES)
        );

        Map<LocalDate, RefillerDateAccumulator> dateAccumulators = new LinkedHashMap<>();
        for (StockEntryRepository.LatestBatchInfo batchInfo : latestBatchInfos) {
            RefillerDateAccumulator accumulator = dateAccumulators.computeIfAbsent(
                    batchInfo.getEntryDate(),
                    ignored -> new RefillerDateAccumulator()
            );
            accumulator.batchCount += 1;
            accumulator.itemCount += Math.toIntExact(batchInfo.getItemCount());
        }

        List<RefillerReportsResponse.ReportDateSummaryResponse> dateSummaries = dateAccumulators.entrySet().stream()
                .sorted(Map.Entry.<LocalDate, RefillerDateAccumulator>comparingByKey().reversed())
                .map(entry -> RefillerReportsResponse.ReportDateSummaryResponse.builder()
                        .date(entry.getKey().toString())
                        .batchCount(entry.getValue().batchCount)
                        .itemCount(entry.getValue().itemCount)
                .build())
                .toList();

        String selectedDate = resolveRefillerSelectedDate(dateSummaries, date);
        LocalDate parsedSelectedDate = parseRefillerSelectedDate(selectedDate);
        List<Long> batchIdsForSelectedDate = latestBatchInfos.stream()
                .filter(batchInfo -> parsedSelectedDate != null && batchInfo.getEntryDate().equals(parsedSelectedDate))
                .map(StockEntryRepository.LatestBatchInfo::getBatchId)
                .toList();

        List<RefillerReportsResponse.RefillerBatchResponse> batches = batchIdsForSelectedDate.isEmpty()
                ? List.of()
                : toRefillerBatchResponses(stockEntryRepository.findByBatchIdInWithProductAndOutlet(batchIdsForSelectedDate));

        return RefillerReportsResponse.builder()
                .selectedDate(selectedDate)
                .dates(dateSummaries)
                .batches(batches)
                .build();
    }

    @Transactional
    public void updateEntry(RefillerStockEntryUpdateRequest request, User currentUser) {
        Outlet outlet = requireRefillerOutlet(currentUser);
        StockEntry entry = stockEntryRepository.findByIdWithProductAndOutlet(request.getEntryId());

        if (entry == null) {
            throw new BusinessException("BIZ_005", "No stock entry found with ID: " + request.getEntryId());
        }

        if (!entry.getOutlet().getId().equals(outlet.getId())) {
            throw new ForbiddenException("You can only edit entries from your assigned outlet");
        }

        List<Long> editableBatchIds = stockEntryRepository.findLatestBatchInfosByOutletId(
                outlet.getId(),
                PageRequest.of(0, MAX_REFILLER_EDITABLE_BATCHES)
        ).stream().map(StockEntryRepository.LatestBatchInfo::getBatchId).toList();

        if (entry.getBatchId() == null || !editableBatchIds.contains(entry.getBatchId())) {
            throw new ForbiddenException("You can only edit entries from your latest five batches");
        }

        int previousQuantity = entry.getQuantity();
        BigDecimal previousAmount = entry.getAmount();

        entry.setQuantity(request.getQuantity());
        entry.setAmount(request.getAmount());
        stockEntryRepository.save(entry);

        auditService.logAction(
                currentUser,
                "UPDATE_STOCK_IN_ENTRY",
                "StockEntry",
                entry.getId(),
                "Updated stock entry for product '" + entry.getProduct().getName()
                        + "' in batch " + entry.getBatchId()
                        + ": quantity " + previousQuantity + " -> " + request.getQuantity()
                        + ", amount " + previousAmount + " -> " + request.getAmount()
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

    private Outlet requireRefillerOutlet(User currentUser) {
        if (currentUser.getRole() != UserRole.REFILLER) {
            throw new ForbiddenException("Only refillers can access this resource");
        }

        if (currentUser.getOutlet() == null) {
            throw new ForbiddenException("User has no outlet assigned");
        }

        return currentUser.getOutlet();
    }

    private String resolveRefillerSelectedDate(
            List<RefillerReportsResponse.ReportDateSummaryResponse> dateSummaries,
            String requestedDate
    ) {
        if (dateSummaries.isEmpty()) {
            return requestedDate != null && !requestedDate.isBlank() ? requestedDate : null;
        }

        if (requestedDate == null || requestedDate.isBlank()) {
            return dateSummaries.get(0).getDate();
        }

        return requestedDate;
    }

    private LocalDate parseRefillerSelectedDate(String selectedDate) {
        if (selectedDate == null || selectedDate.isBlank()) {
            return null;
        }

        try {
            return LocalDate.parse(selectedDate);
        } catch (DateTimeParseException exception) {
            return null;
        }
    }

    private List<RefillerReportsResponse.RefillerBatchResponse> toRefillerBatchResponses(List<StockEntry> entries) {
        Map<Long, List<StockEntry>> entriesByBatchId = new LinkedHashMap<>();
        for (StockEntry entry : entries) {
            if (entry.getBatchId() == null) {
                continue;
            }
            entriesByBatchId.computeIfAbsent(entry.getBatchId(), ignored -> new ArrayList<>()).add(entry);
        }

        List<RefillerReportsResponse.RefillerBatchResponse> batches = entriesByBatchId.entrySet().stream()
                .map(entry -> {
                    List<StockEntry> batchEntries = entry.getValue();
                    StockEntry firstEntry = batchEntries.get(0);

                    List<RefillerReportsResponse.RefillerBatchEntryResponse> items = batchEntries.stream()
                            .map(batchEntry -> RefillerReportsResponse.RefillerBatchEntryResponse.builder()
                                    .id(batchEntry.getId())
                                    .productId(batchEntry.getProduct().getId())
                                    .productName(batchEntry.getProduct().getName())
                                    .brand(batchEntry.getProduct().getBrand())
                                    .quantity(batchEntry.getQuantity())
                                    .amount(batchEntry.getAmount())
                                    .build())
                            .toList();

                    return RefillerReportsResponse.RefillerBatchResponse.builder()
                            .batchId(entry.getKey())
                            .entryDate(firstEntry.getEntryDate().toString())
                            .createdAt(firstEntry.getCreatedAt().toString())
                            .batchNumber(0)
                            .batchName(firstEntry.getBatchName())
                            .itemCount(items.size())
                            .entries(items)
                            .build();
                })
                .sorted(Comparator.comparing(RefillerReportsResponse.RefillerBatchResponse::getCreatedAt).reversed())
                .toList();

        for (int index = 0; index < batches.size(); index++) {
            batches.get(index).setBatchNumber(index + 1);
        }

        return batches;
    }

    private static class RefillerDateAccumulator {
        private int batchCount;
        private int itemCount;
    }
}
