<#import "template.ftl" as layout>
<@layout.registrationLayout displayInfo=social.displayInfo; section>
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

        <h1 class="page-title">Welcome back</h1>
        <p class="page-subtitle">Sign in to your account to continue</p>

        <#if realm.password && social.providers??>
            <div class="social-providers">
                <#list social.providers as p>
                    <a href="${p.loginUrl}" class="social-btn social-btn-${p.providerId}">
                        <#if p.providerId == "keycloak" || p.providerId == "keycloak-oidc">
                            <svg class="social-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                            </svg>
                        <#elseif p.providerId == "google">
                            <svg class="social-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                            </svg>
                        <#else>
                            <span class="social-icon-text">${p.displayName[0]}</span>
                        </#if>
                        <span>Continue with ${p.displayName}</span>
                    </a>
                </#list>
            </div>
            <div class="divider">
                <span>or sign in with email</span>
            </div>
        </#if>

        <#if realm.password>
            <form id="kc-form-login" action="${url.loginAction}" method="post" class="login-form">
                <#if !usernameHidden??>
                <div class="field-group">
                    <label class="field-label" for="username">
                        <#if !realm.loginWithEmailAllowed>${msg("username")}<#elseif !realm.registrationEmailAsUsername>${msg("usernameOrEmail")}<#else>${msg("email")}</#if>
                    </label>
                    <div class="field-input-wrap">
                        <svg class="field-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                        </svg>
                        <input tabindex="1" id="username" class="field-input" name="username" type="text"
                               value="${(login.username!'')}" autofocus autocomplete="off"
                               placeholder="<#if !realm.loginWithEmailAllowed>Your username<#elseif !realm.registrationEmailAsUsername>Username or email<#else>your@email.com</#if>"/>
                    </div>
                    <#if messagesPerField.existsError('username','password')>
                        <span class="field-error">${kcSanitize(messagesPerField.getFirstError('username','password'))?no_esc}</span>
                    </#if>
                </div>
                </#if>

                <div class="field-group">
                    <label class="field-label" for="password">${msg("password")}</label>
                    <div class="field-input-wrap">
                        <svg class="field-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                        </svg>
                        <input tabindex="2" id="password" class="field-input" name="password" type="password"
                               autocomplete="current-password" placeholder="Enter your password"/>
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

                <div class="form-row">
                    <#if realm.rememberMe && !usernameHidden??>
                        <label class="checkbox-label">
                            <input tabindex="3" id="rememberMe" name="rememberMe" type="checkbox"
                                   <#if login.rememberMe??>checked</#if> class="checkbox-input"/>
                            <span class="checkbox-custom"></span>
                            <span>${msg("rememberMe")}</span>
                        </label>
                    </#if>
                    <#if realm.resetPasswordAllowed>
                        <a tabindex="5" href="${url.loginResetCredentialsUrl}" class="forgot-link">${msg("doForgotPassword")}</a>
                    </#if>
                </div>

                <#if message?has_content && (message.type != 'warning' || !isAppInitiatedAction??)>
                    <div class="alert alert-${message.type}">
                        <#if message.type = 'success'><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg></#if>
                        <#if message.type = 'warning'><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></#if>
                        <#if message.type = 'error'><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg></#if>
                        <span>${kcSanitize(message.summary)?no_esc}</span>
                    </div>
                </#if>

                <input tabindex="4" class="btn-primary" name="login" id="kc-login" type="submit" value="${msg("doLogIn")}"/>
            </form>
        </#if>

        <#if realm.password && realm.registrationAllowed && !registrationDisabled??>
            <p class="register-link">
                ${msg("noAccount")} <a tabindex="6" href="${url.registrationUrl}">${msg("doRegister")}</a>
            </p>
        </#if>

    </div>
    </#if>
</@layout.registrationLayout>
