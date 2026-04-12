<#import "template.ftl" as layout>
<@layout.registrationLayout; section>
    <#if section = "header"></#if>
    <#if section = "form">
    <div class="login-container">

        <div class="brand">
            <div class="brand-icon">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
            </div>
            <span class="brand-name">${realm.displayName!realm.name}</span>
        </div>

        <h1 class="page-title">Create an account</h1>
        <p class="page-subtitle">Fill in the details below to get started</p>

        <form id="kc-register-form" action="${url.registrationAction}" method="post" class="login-form">

            <div class="field-row">
                <div class="field-group">
                    <label class="field-label" for="firstName">${msg("firstName")}</label>
                    <div class="field-input-wrap">
                        <svg class="field-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                        </svg>
                        <input type="text" id="firstName" name="firstName" class="field-input"
                               value="${(register.formData.firstName!'')}" placeholder="John"
                               autocomplete="given-name"/>
                    </div>
                    <#if messagesPerField.existsError('firstName')>
                        <span class="field-error">${kcSanitize(messagesPerField.getFirstError('firstName'))?no_esc}</span>
                    </#if>
                </div>

                <div class="field-group">
                    <label class="field-label" for="lastName">${msg("lastName")}</label>
                    <div class="field-input-wrap">
                        <svg class="field-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                        </svg>
                        <input type="text" id="lastName" name="lastName" class="field-input"
                               value="${(register.formData.lastName!'')}" placeholder="Doe"
                               autocomplete="family-name"/>
                    </div>
                    <#if messagesPerField.existsError('lastName')>
                        <span class="field-error">${kcSanitize(messagesPerField.getFirstError('lastName'))?no_esc}</span>
                    </#if>
                </div>
            </div>

            <div class="field-group">
                <label class="field-label" for="email">${msg("email")}</label>
                <div class="field-input-wrap">
                    <svg class="field-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                    </svg>
                    <input type="email" id="email" name="email" class="field-input"
                           value="${(register.formData.email!'')}" placeholder="your@email.com"
                           autocomplete="email"/>
                </div>
                <#if messagesPerField.existsError('email')>
                    <span class="field-error">${kcSanitize(messagesPerField.getFirstError('email'))?no_esc}</span>
                </#if>
            </div>

            <#if !realm.registrationEmailAsUsername>
            <div class="field-group">
                <label class="field-label" for="username">${msg("username")}</label>
                <div class="field-input-wrap">
                    <svg class="field-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/><path d="M8.56 2.75c4.37 6.03 6.02 9.42 8.03 17.72m2.54-15.38c-3.72 4.35-8.94 5.66-16.88 5.85m19.5 1.9c-3.5-.93-6.63-.82-8.94 0-2.58.92-5.01 2.86-7.44 6.32"/>
                    </svg>
                    <input type="text" id="username" name="username" class="field-input"
                           value="${(register.formData.username!'')}" placeholder="Choose a username"
                           autocomplete="username"/>
                </div>
                <#if messagesPerField.existsError('username')>
                    <span class="field-error">${kcSanitize(messagesPerField.getFirstError('username'))?no_esc}</span>
                </#if>
            </div>
            </#if>

            <#if passwordRequired??>
            <div class="field-group">
                <label class="field-label" for="password">${msg("password")}</label>
                <div class="field-input-wrap">
                    <svg class="field-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                    <input type="password" id="password" name="password" class="field-input"
                           autocomplete="new-password" placeholder="Create a password"/>
                    <button type="button" class="toggle-password" onclick="togglePassword()">
                        <svg id="eye-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                        </svg>
                    </button>
                </div>
                <#if messagesPerField.existsError('password')>
                    <span class="field-error">${kcSanitize(messagesPerField.getFirstError('password'))?no_esc}</span>
                </#if>
            </div>

            <div class="field-group">
                <label class="field-label" for="password-confirm">${msg("passwordConfirm")}</label>
                <div class="field-input-wrap">
                    <svg class="field-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                    <input type="password" id="password-confirm" name="password-confirm" class="field-input"
                           autocomplete="new-password" placeholder="Confirm your password"/>
                </div>
                <#if messagesPerField.existsError('password-confirm')>
                    <span class="field-error">${kcSanitize(messagesPerField.getFirstError('password-confirm'))?no_esc}</span>
                </#if>
            </div>
            </#if>

            <#if recaptchaRequired??>
            <div class="field-group">
                <div class="g-recaptcha" data-size="compact" data-sitekey="${recaptchaSiteKey}"></div>
            </div>
            </#if>

            <#if message?has_content && (message.type != 'warning' || !isAppInitiatedAction??)>
                <div class="alert alert-${message.type}">
                    <#if message.type = 'success'><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg></#if>
                    <#if message.type = 'warning'><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></#if>
                    <#if message.type = 'error'><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg></#if>
                    <span>${kcSanitize(message.summary)?no_esc}</span>
                </div>
            </#if>

            <input class="btn-primary" type="submit" value="${msg("doRegister")}"/>

        </form>

        <p class="register-link">
            ${msg("backToLogin")} <a href="${url.loginUrl}">${msg("doLogIn")}</a>
        </p>

    </div>
    </#if>
</@layout.registrationLayout>
