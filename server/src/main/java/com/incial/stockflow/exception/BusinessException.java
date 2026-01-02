package com.incial.stockflow.exception;

import lombok.Getter;

import java.util.Map;

@Getter
public class BusinessException extends RuntimeException {
    private final String errorCode;
    private final Map<String, String> details;
    
    public BusinessException(String errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
        this.details = null;
    }
    
    public BusinessException(String errorCode, String message, Map<String, String> details) {
        super(message);
        this.errorCode = errorCode;
        this.details = details;
    }
}
