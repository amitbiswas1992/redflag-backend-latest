<#import "template.ftl" as layout>
<#import "user-profile-commons.ftl" as userProfileCommons>
<@layout.registrationLayout displayMessage=messagesPerField.exists('global') displayRequiredFields=true; section>
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

        <h1 class="page-title">Review your profile</h1>
        <p class="page-subtitle">Please verify your information before continuing</p>

        <form id="kc-idp-review-profile-form" action="${url.loginAction}" method="post" class="login-form profile-form">
            <@userProfileCommons.userProfileFormFields/>

            <div class="form-row form-row-actions">
                <input class="btn-primary" type="submit" value="${msg("doSubmit")}" />
            </div>
        </form>
    </div>
    </#if>
</@layout.registrationLayout>
