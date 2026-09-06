package com.docspace.template.config

/**
 * Hardcoded Doctor and Practice Configuration.
 * These values are injected at build time for each doctor's individual Android app.
 */
object DoctorConfig {
    const val DOCTOR_NAME: String = "{{DOCTOR_NAME}}"
    const val CLINIC_NAME: String = "{{CLINIC_NAME}}"
    const val SPECIALITY: String = "{{SPECIALITY}}"
    const val BIO: String = """{{BIO}}"""
    const val LOCATION: String = "{{LOCATION}}"
    const val AVATAR_URL: String = "{{AVATAR_URL}}"
    const val PHONE: String = "{{PHONE}}"
    const val EMAIL: String = "{{EMAIL}}"
    const val SLUG: String = "{{SLUG}}"

    // Platform Services Enabled Flags
    const val SERVICE_APPOINTMENT: Boolean = {{SERVICE_APPOINTMENT}}
    const val SERVICE_VIDEO_CONSULTATION: Boolean = {{SERVICE_VIDEO_CONSULTATION}}
    const val SERVICE_MEDICINE_INVENTORY: Boolean = {{SERVICE_MEDICINE_INVENTORY}}
    const val SERVICE_LAB_REPORTS: Boolean = {{SERVICE_LAB_REPORTS}}
}

