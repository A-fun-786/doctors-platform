package com.docspace.template.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.docspace.template.R
import com.docspace.template.config.DoctorConfig
import com.docspace.template.ui.theme.*
import java.text.SimpleDateFormat
import java.util.*

@Composable
private fun RowScope.TimeSlotChip(
    slot: String,
    isSelected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .weight(1f)
            .clip(RoundedCornerShape(8.dp))
            .background(if (isSelected) Brand600 else Slate50)
            .border(
                1.dp,
                if (isSelected) Brand600 else Slate200,
                RoundedCornerShape(8.dp)
            )
            .clickable(onClick = onClick)
            .padding(vertical = 10.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = slot,
            style = MaterialTheme.typography.bodySmall,
            color = if (isSelected) Color.White else Slate700,
            fontWeight = FontWeight.SemiBold,
            fontSize = 12.sp
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AppointmentBookingCard(
    modifier: Modifier = Modifier
) {
    val timeSlots = listOf(
        "09:00 AM", "10:00 AM", "11:30 AM",
        "02:00 PM", "03:30 PM", "04:45 PM"
    )

    var selectedSlot by rememberSaveable { mutableStateOf(timeSlots[0]) }
    var patientName by rememberSaveable { mutableStateOf("") }
    var patientPhone by rememberSaveable { mutableStateOf("") }
    var patientEmail by rememberSaveable { mutableStateOf("") }
    var symptomsNotes by rememberSaveable { mutableStateOf("") }
    var isSubmitted by rememberSaveable { mutableStateOf(false) }
    var bookingId by rememberSaveable { mutableStateOf("APT-" + UUID.randomUUID().toString().take(8).uppercase()) }

    var nameError by rememberSaveable { mutableStateOf(false) }
    var phoneError by rememberSaveable { mutableStateOf(false) }

    val currentDate = remember {
        val calendar = Calendar.getInstance()
        calendar.add(Calendar.DAY_OF_YEAR, 1)
        val sdf = SimpleDateFormat("EEE, MMM dd, yyyy", Locale.getDefault())
        sdf.format(calendar.time)
    }

    val clinicBadge = DoctorConfig.CLINIC_NAME.ifBlank {
        stringResource(R.string.badge_default_clinic)
    }

    DocSpaceCardScaffold(
        title = stringResource(R.string.title_in_clinic_visit),
        subtitle = stringResource(R.string.subtitle_in_clinic_visit),
        badgeText = clinicBadge,
        icon = Icons.Default.CalendarMonth,
        iconContentDescription = stringResource(R.string.cd_in_clinic_card_icon),
        gradientColors = listOf(Brand600, Brand700),
        modifier = modifier
    ) {
        if (isSubmitted) {
            // Success State View
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(28.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Box(
                    modifier = Modifier
                        .size(60.dp)
                        .clip(CircleShape)
                        .background(Emerald50)
                        .border(1.dp, Emerald100, CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.CheckCircle,
                        contentDescription = stringResource(R.string.cd_success_icon),
                        tint = Emerald600,
                        modifier = Modifier.size(34.dp)
                    )
                }

                Spacer(modifier = Modifier.height(14.dp))

                Text(
                    text = stringResource(R.string.msg_appointment_requested),
                    style = MaterialTheme.typography.titleLarge,
                    color = Slate900,
                    fontWeight = FontWeight.Bold
                )

                Spacer(modifier = Modifier.height(6.dp))

                Text(
                    text = stringResource(
                        R.string.msg_booking_reference,
                        bookingId,
                        DoctorConfig.DOCTOR_NAME
                    ),
                    style = MaterialTheme.typography.bodySmall,
                    color = Slate600,
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                    lineHeight = 18.sp
                )

                Spacer(modifier = Modifier.height(18.dp))

                OutlinedButton(
                    onClick = {
                        isSubmitted = false
                        bookingId = "APT-" + UUID.randomUUID().toString().take(8).uppercase()
                        patientName = ""
                        patientPhone = ""
                        patientEmail = ""
                        symptomsNotes = ""
                        nameError = false
                        phoneError = false
                    },
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Text(
                        text = stringResource(R.string.btn_book_another),
                        color = Slate700,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
        } else {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Date Field
                Column {
                    Text(
                        text = stringResource(R.string.lbl_preferred_date),
                        style = MaterialTheme.typography.labelMedium,
                        color = Slate600,
                        fontWeight = FontWeight.Bold,
                        fontSize = 11.sp
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(10.dp))
                            .background(Slate50)
                            .border(1.dp, Slate200, RoundedCornerShape(10.dp))
                            .padding(horizontal = 14.dp, vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Default.Event,
                            contentDescription = stringResource(R.string.cd_date_icon),
                            tint = Brand600,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(10.dp))
                        Text(
                            text = currentDate,
                            style = MaterialTheme.typography.bodyMedium,
                            color = Slate900,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }

                // Available Time Slot Grid
                Column {
                    Text(
                        text = stringResource(R.string.lbl_available_time_slot),
                        style = MaterialTheme.typography.labelMedium,
                        color = Slate600,
                        fontWeight = FontWeight.Bold,
                        fontSize = 11.sp
                    )
                    Spacer(modifier = Modifier.height(8.dp))

                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        timeSlots.chunked(3).forEach { rowSlots ->
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                rowSlots.forEach { slot ->
                                    TimeSlotChip(
                                        slot = slot,
                                        isSelected = slot == selectedSlot,
                                        onClick = { selectedSlot = slot }
                                    )
                                }
                            }
                        }
                    }
                }

                // Patient Details Section Header
                Text(
                    text = stringResource(R.string.lbl_patient_details),
                    style = MaterialTheme.typography.labelMedium,
                    color = Slate600,
                    fontWeight = FontWeight.Bold,
                    fontSize = 11.sp
                )

                // Patient Name
                OutlinedTextField(
                    value = patientName,
                    onValueChange = {
                        patientName = it
                        if (nameError && it.isNotBlank()) nameError = false
                    },
                    label = { Text(stringResource(R.string.lbl_full_name)) },
                    placeholder = { Text(stringResource(R.string.placeholder_patient_name)) },
                    leadingIcon = {
                        Icon(
                            imageVector = Icons.Default.Person,
                            contentDescription = stringResource(R.string.cd_name_icon),
                            tint = Slate400
                        )
                    },
                    isError = nameError,
                    supportingText = if (nameError) {
                        { Text(stringResource(R.string.err_name_required), color = MaterialTheme.colorScheme.error) }
                    } else null,
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Brand600,
                        unfocusedBorderColor = Slate200
                    )
                )

                // Phone Number
                OutlinedTextField(
                    value = patientPhone,
                    onValueChange = {
                        patientPhone = it
                        if (phoneError && it.isNotBlank()) phoneError = false
                    },
                    label = { Text(stringResource(R.string.lbl_phone_number)) },
                    placeholder = { Text(stringResource(R.string.placeholder_phone_number)) },
                    leadingIcon = {
                        Icon(
                            imageVector = Icons.Default.Phone,
                            contentDescription = stringResource(R.string.cd_phone_icon),
                            tint = Slate400
                        )
                    },
                    isError = phoneError,
                    supportingText = if (phoneError) {
                        { Text(stringResource(R.string.err_phone_required), color = MaterialTheme.colorScheme.error) }
                    } else null,
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Brand600,
                        unfocusedBorderColor = Slate200
                    )
                )

                // Email Address
                OutlinedTextField(
                    value = patientEmail,
                    onValueChange = { patientEmail = it },
                    label = { Text(stringResource(R.string.lbl_email_optional)) },
                    placeholder = { Text(stringResource(R.string.placeholder_email)) },
                    leadingIcon = {
                        Icon(
                            imageVector = Icons.Default.Email,
                            contentDescription = stringResource(R.string.cd_email_icon),
                            tint = Slate400
                        )
                    },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Brand600,
                        unfocusedBorderColor = Slate200
                    )
                )

                // Reason for visit / Symptoms Notes
                OutlinedTextField(
                    value = symptomsNotes,
                    onValueChange = { symptomsNotes = it },
                    label = { Text(stringResource(R.string.lbl_symptoms_optional)) },
                    placeholder = { Text(stringResource(R.string.placeholder_symptoms)) },
                    maxLines = 3,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Brand600,
                        unfocusedBorderColor = Slate200
                    )
                )

                // Confirm Appointment Button
                Button(
                    onClick = {
                        val hasName = patientName.isNotBlank()
                        val hasPhone = patientPhone.isNotBlank()
                        nameError = !hasName
                        phoneError = !hasPhone
                        if (hasName && hasPhone) {
                            isSubmitted = true
                        }
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp),
                    shape = RoundedCornerShape(10.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Brand600
                    )
                ) {
                    Text(
                        text = stringResource(R.string.btn_confirm_appointment),
                        style = MaterialTheme.typography.titleMedium,
                        color = Color.White,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Icon(
                        imageVector = Icons.Default.ArrowForward,
                        contentDescription = stringResource(R.string.cd_confirm_icon),
                        modifier = Modifier.size(16.dp)
                    )
                }
            }
        }
    }
}
