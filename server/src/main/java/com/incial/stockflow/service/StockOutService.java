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

        List<UUID> productIds = request.getItems().stream()
                .map(StockOutItemRequest::getProductId)
                .distinct()
                .toList();
        Map<UUID, Product> productsById = productService.getProductsByIds(productIds);
        Map<UUID, Integer> availableStockByProductId = calculateAvailableStock(effectiveOutletId, productIds);

        List<StockOutEntry> entriesToSave = new ArrayList<>();
        Map<UUID, Integer> requestedQuantityByProductId = new HashMap<>();
        for (StockOutItemRequest item : request.getItems()) {
            Product product = productsById.get(item.getProductId());
            int totalRequestedQuantity = requestedQuantityByProductId.getOrDefault(item.getProductId(), 0)
                    + item.getQuantity();
            int availableStock = availableStockByProductId.getOrDefault(item.getProductId(), 0);

            if (availableStock < totalRequestedQuantity) {
                throw new BusinessException(
                        "BIZ_001",
                        "Insufficient stock for product '" + product.getName()
                                + "' at outlet '" + outlet.getName() + "'"
                );
            }
            requestedQuantityByProductId.put(item.getProductId(), totalRequestedQuantity);

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

            entriesToSave.add(entry);
        }

        stockOutEntryRepository.saveAll(entriesToSave);
        List<StockOutEntryResponse> responses = entriesToSave.stream()
                .map(this::toResponse)
                .toList();

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

    private Map<UUID, Integer> calculateAvailableStock(UUID outletId, List<UUID> productIds) {
        Map<UUID, Integer> totalStockInByProductId = new HashMap<>();
        stockEntryRepository.totalStockInByOutletAndProductIds(outletId, productIds)
                .forEach(total -> totalStockInByProductId.put(total.getProductId(), total.getTotalQuantity()));

        Map<UUID, Integer> totalStockOutByProductId = new HashMap<>();
        stockOutEntryRepository.totalStockOutByOutletAndProductIds(outletId, productIds)
                .forEach(total -> totalStockOutByProductId.put(total.getProductId(), total.getTotalQuantity()));

        Map<UUID, Integer> availableStockByProductId = new HashMap<>();
        for (UUID productId : productIds) {
            int totalIn = totalStockInByProductId.getOrDefault(productId, 0);
            int totalOut = totalStockOutByProductId.getOrDefault(productId, 0);
            availableStockByProductId.put(productId, totalIn - totalOut);
        }

        return availableStockByProductId;
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
