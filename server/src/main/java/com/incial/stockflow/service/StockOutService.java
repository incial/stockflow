package com.incial.stockflow.service;

import com.incial.stockflow.dto.request.StockOutBatchRequest;
import com.incial.stockflow.dto.request.StockOutItemRequest;
import com.incial.stockflow.dto.response.StockOutEntryResponse;
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
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class StockOutService {

    private final StockOutEntryRepository stockOutEntryRepository;
    private final StockEntryRepository stockEntryRepository;
    private final OutletService outletService;
    private final ProductService productService;
    private final AuditService auditService;

    // -------------------------------------------------
    // READ
    // -------------------------------------------------

    @Transactional(readOnly = true)
    public List<StockOutEntryResponse> getStockOutEntries(
            UUID outletId,
            User currentUser
    ) {

        List<StockOutEntry> entries;

        if (currentUser.getRole() == UserRole.REFILLER) {
            if (currentUser.getOutlet() == null) {
                throw new ForbiddenException("User has no outlet assigned");
            }
            entries = stockOutEntryRepository
                    .findByOutletIdOrderByDateDescCreatedAtDesc(
                            currentUser.getOutlet().getId()
                    );
        } else {
            entries = outletId != null
                    ? stockOutEntryRepository
                    .findByOutletIdOrderByDateDescCreatedAtDesc(outletId)
                    : stockOutEntryRepository
                    .findAllByOrderByDateDescCreatedAtDesc();
        }

        return entries.stream()
                .map(this::toResponse)
                .toList();
    }

    // -------------------------------------------------
    // WRITE (BATCH)
    // -------------------------------------------------

    @Transactional
    public List<StockOutEntryResponse> addBatch(
            StockOutBatchRequest request,
            User currentUser
    ) {

        UUID effectiveOutletId = request.getOutletId();

        if (currentUser.getRole() == UserRole.REFILLER) {
            if (currentUser.getOutlet() == null) {
                throw new ForbiddenException("User has no outlet assigned");
            }
            if (!currentUser.getOutlet().getId().equals(request.getOutletId())) {
                throw new ForbiddenException(
                        "You can only record stock out for your assigned outlet"
                );
            }
            effectiveOutletId = currentUser.getOutlet().getId();
        }

        Outlet outlet = outletService.getOutletById(effectiveOutletId);

        if (request.getEntryDate().isAfter(LocalDate.now())) {
            throw new BusinessException(
                    "VAL_004",
                    "Date cannot be in the future"
            );
        }

        List<StockOutEntryResponse> responses = new ArrayList<>();

        for (StockOutItemRequest item : request.getItems()) {

            Product product = productService.getProductById(item.getProductId());

            int availableStock = calculateAvailableStock(
                    effectiveOutletId,
                    item.getProductId()
            );

            if (availableStock < item.getQuantity()) {
                throw new BusinessException(
                        "BIZ_001",
                        "Insufficient stock for product '" + product.getName()
                                + "' at outlet '" + outlet.getName() + "'"
                );
            }

            StockOutReason reason;
            try {
                reason = StockOutReason.valueOf(item.getReason());
            } catch (IllegalArgumentException ex) {
                throw new BusinessException(
                        "BIZ_003",
                        "Invalid stock out reason"
                );
            }

            StockOutEntry entry = StockOutEntry.builder()
                    .outlet(outlet)
                    .product(product)
                    .quantity(item.getQuantity())
                    .date(request.getEntryDate())
                    .reason(reason)
                    .enteredBy(currentUser)
                    .build();

            responses.add(
                    toResponse(stockOutEntryRepository.save(entry))
            );
        }

        auditService.logAction(
                currentUser,
                "CREATE_STOCK_OUT_BATCH",
                "StockOutEntry",
                null,
                "Created " + responses.size()
                        + " stock out entries for outlet: "
                        + outlet.getName()
        );

        return responses;
    }

    // -------------------------------------------------
    // Helpers
    // -------------------------------------------------

    private int calculateAvailableStock(UUID outletId, UUID productId) {
        int totalIn = stockEntryRepository.totalStockIn(outletId, productId);
        int totalOut = stockOutEntryRepository.totalStockOut(outletId, productId);
        return totalIn - totalOut;
    }

    private StockOutEntryResponse toResponse(StockOutEntry entry) {
        return StockOutEntryResponse.builder()
                .id(entry.getId())
                .outletId(entry.getOutlet().getId())
                .productId(entry.getProduct().getId())
                .quantity(entry.getQuantity())
                .date(entry.getDate())
                .reason(entry.getReason().name())
                .build();
    }
}
