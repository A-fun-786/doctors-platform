package com.docspace.template.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.docspace.template.config.DoctorConfig
import com.docspace.template.ui.components.*
import com.docspace.template.ui.theme.*

@Composable
fun HomeScreen() {
    var selectedTab by remember { mutableIntStateOf(0) }
    val tabs = listOf("Doctor Profile", "Services & Booking")

    Scaffold(
        topBar = {
            Column {
                DocSpaceTopBar()
                // Navigation Tabs
                TabRow(
                    selectedTabIndex = selectedTab,
                    containerColor = Color.White,
                    contentColor = Brand600,
                    divider = {
                        HorizontalDivider(color = Slate200, thickness = 1.dp)
                    }
                ) {
                    tabs.forEachIndexed { index, title ->
                        Tab(
                            selected = selectedTab == index,
                            onClick = { selectedTab = index },
                            text = {
                                Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                                    Icon(
                                        imageVector = if (index == 0) Icons.Default.Person else Icons.Default.CalendarMonth,
                                        contentDescription = title,
                                        modifier = Modifier.size(16.dp),
                                        tint = if (selectedTab == index) Brand600 else Slate400
                                    )
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text(
                                        text = title,
                                        fontWeight = if (selectedTab == index) FontWeight.Bold else FontWeight.Medium,
                                        fontSize = 13.sp,
                                        color = if (selectedTab == index) Brand600 else Slate600
                                    )
                                }
                            }
                        )
                    }
                }
            }
        },
        containerColor = Slate50
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .background(Slate50),
            contentPadding = PaddingValues(bottom = 24.dp)
        ) {
            if (selectedTab == 0) {
                // DOCTOR PROFILE TAB
                item {
                    DoctorHeroProfile()
                }

                // Enabled Services Summary
                item {
                    Surface(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 4.dp),
                        shape = androidx.compose.foundation.shape.RoundedCornerShape(20.dp),
                        color = Color.White,
                        shadowElevation = 1.dp
                    ) {
                        Column(modifier = Modifier.padding(20.dp)) {
                            Text(
                                text = "AVAILABLE PRACTICE SERVICES",
                                style = MaterialTheme.typography.labelMedium,
                                color = Slate500,
                                fontWeight = FontWeight.Bold,
                                fontSize = 11.sp,
                                letterSpacing = 0.8.sp
                            )
                            Spacer(modifier = Modifier.height(12.dp))

                            if (DoctorConfig.SERVICE_APPOINTMENT) {
                                ServiceItemRow(
                                    title = "In-Clinic Consultations",
                                    subtitle = "Face-to-face appointments at ${DoctorConfig.CLINIC_NAME.ifBlank { "the clinic" }}"
                                )
                            }

                            if (DoctorConfig.SERVICE_VIDEO_CONSULTATION) {
                                ServiceItemRow(
                                    title = "Telehealth Video Consultations",
                                    subtitle = "Secure remote video calls from your home or mobile"
                                )
                            }

                            if (DoctorConfig.SERVICE_MEDICINE_INVENTORY) {
                                ServiceItemRow(
                                    title = "Clinic Pharmacy & Prescriptions",
                                    subtitle = "Order medicine repeats and home delivery"
                                )
                            }

                            if (DoctorConfig.SERVICE_LAB_REPORTS) {
                                ServiceItemRow(
                                    title = "Diagnostic & Lab Test Upload",
                                    subtitle = "Directly share test reports with the doctor"
                                )
                            }

                            Spacer(modifier = Modifier.height(16.dp))
                            Button(
                                onClick = { selectedTab = 1 },
                                modifier = Modifier.fillMaxWidth(),
                                shape = androidx.compose.foundation.shape.RoundedCornerShape(10.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = Brand600)
                            ) {
                                Text("Go to Services & Booking", fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }

                item {
                    DocSpaceFooter()
                }
            } else {
                // SERVICES & BOOKING TAB
                if (DoctorConfig.SERVICE_APPOINTMENT) {
                    item {
                        AppointmentBookingCard()
                    }
                }

                if (DoctorConfig.SERVICE_VIDEO_CONSULTATION) {
                    item {
                        VideoConsultationCard()
                    }
                }

                if (DoctorConfig.SERVICE_MEDICINE_INVENTORY) {
                    item {
                        MedicineDeliveryCard()
                    }
                }

                if (DoctorConfig.SERVICE_LAB_REPORTS) {
                    item {
                        LabDiagnosticsCard()
                    }
                }

                // If no services enabled at all
                if (!DoctorConfig.SERVICE_APPOINTMENT &&
                    !DoctorConfig.SERVICE_VIDEO_CONSULTATION &&
                    !DoctorConfig.SERVICE_MEDICINE_INVENTORY &&
                    !DoctorConfig.SERVICE_LAB_REPORTS
                ) {
                    item {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(32.dp),
                            contentAlignment = androidx.compose.ui.Alignment.Center
                        ) {
                            Text(
                                text = "No online services currently published for this clinic.",
                                color = Slate500,
                                fontSize = 14.sp
                            )
                        }
                    }
                }

                item {
                    DocSpaceFooter()
                }
            }
        }
    }
}

@Composable
private fun ServiceItemRow(title: String, subtitle: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        verticalAlignment = androidx.compose.ui.Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(8.dp)
                .background(Brand600, androidx.compose.foundation.shape.CircleShape)
        )
        Spacer(modifier = Modifier.width(12.dp))
        Column {
            Text(
                text = title,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.SemiBold,
                color = Slate900
            )
            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodySmall,
                color = Slate600
            )
        }
    }
}

