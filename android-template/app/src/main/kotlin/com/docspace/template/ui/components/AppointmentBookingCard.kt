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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.docspace.template.config.DoctorConfig
import com.docspace.template.ui.theme.*
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AppointmentBookingCard() {
    val timeSlots = listOf(
        "09:00 AM", "10:00 AM", "11:30 AM",
        "02:00 PM", "03:30 PM", "04:45 PM"
    )

    var selectedSlot by remember { mutableStateOf(timeSlots[0]) }
    var patientName by remember { mutableStateOf("") }
    var patientPhone by remember { mutableStateOf("") }
    var patientEmail by remember { mutableStateOf("") }
    var symptomsNotes by remember { mutableStateOf("") }
    var isSubmitted by remember { mutableStateOf(false) }
    var bookingId by remember { mutableStateOf("APT-" + UUID.randomUUID().toString().take(8).uppercase()) }

    val currentDate = remember {
        val calendar = Calendar.getInstance()
        calendar.add(Calendar.DAY_OF_YEAR, 1)
        val sdf = SimpleDateFormat("EEE, MMM dd, yyyy", Locale.getDefault())
        sdf.format(calendar.time)
    }

    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp)
            .shadow(2.dp, RoundedCornerShape(20.dp)),
        shape = RoundedCornerShape(20.dp),
        color = Color.White
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            // Gradient Header matching website
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(
                        Brush.horizontalGradient(
                            colors = listOf(Color(0xFF2563EB), Color(0xFF1D4ED8))
                        )
                    )
                    .padding(20.dp)
            ) {
                Column {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .size(38.dp)
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(Color.White.copy(alpha = 0.2f)),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Default.CalendarMonth,
                                    contentDescription = "Appointment",
                                    tint = Color.White,
                                    modifier = Modifier.size(20.dp)
                                )
                            }
                            Spacer(modifier = Modifier.width(10.dp))
                            Text(
                                text = "Book In-Clinic Visit",
                                style = MaterialTheme.typography.titleLarge,
                                color = Color.White,
                                fontWeight = FontWeight.Bold
                            )
                        }

                        // Clinic Badge
                        Box(
                            modifier = Modifier
                                .clip(CircleShape)
                                .background(Color.White.copy(alpha = 0.25f))
                                .padding(horizontal = 10.dp, vertical = 4.dp)
                        ) {
                            Text(
                                text = DoctorConfig.CLINIC_NAME.ifBlank { "Doctor Clinic" },
                                style = MaterialTheme.typography.bodySmall,
                                color = Color.White,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(6.dp))

                    Text(
                        text = "Select your preferred date & time slot for your in-person clinic consultation.",
                        style = MaterialTheme.typography.bodySmall,
                        color = Color.White.copy(alpha = 0.85f),
                        fontSize = 12.sp
                    )
                }
            }

            // Form Content
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
                            contentDescription = "Success",
                            tint = Emerald600,
                            modifier = Modifier.size(34.dp)
                        )
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    Text(
                        text = "Appointment Requested!",
                        style = MaterialTheme.typography.titleLarge,
                        color = Slate900,
                        fontWeight = FontWeight.Bold
                    )

                    Spacer(modifier = Modifier.height(6.dp))

                    Text(
                        text = "Your booking reference is $bookingId. An appointment record has been created for ${DoctorConfig.DOCTOR_NAME}.",
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
                        },
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Text("Book Another Appointment", color = Slate700, fontWeight = FontWeight.SemiBold)
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
                            text = "PREFERRED DATE",
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
                                contentDescription = "Date",
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
                            text = "AVAILABLE TIME SLOT",
                            style = MaterialTheme.typography.labelMedium,
                            color = Slate600,
                            fontWeight = FontWeight.Bold,
                            fontSize = 11.sp
                        )
                        Spacer(modifier = Modifier.height(8.dp))

                        // 3 column slots
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            timeSlots.take(3).forEach { slot ->
                                val isSelected = slot == selectedSlot
                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .clip(RoundedCornerShape(8.dp))
                                        .background(if (isSelected) Brand600 else Slate50)
                                        .border(
                                            1.dp,
                                            if (isSelected) Brand600 else Slate200,
                                            RoundedCornerShape(8.dp)
                                        )
                                        .clickable { selectedSlot = slot }
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
                        }

                        Spacer(modifier = Modifier.height(8.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            timeSlots.drop(3).take(3).forEach { slot ->
                                val isSelected = slot == selectedSlot
                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .clip(RoundedCornerShape(8.dp))
                                        .background(if (isSelected) Brand600 else Slate50)
                                        .border(
                                            1.dp,
                                            if (isSelected) Brand600 else Slate200,
                                            RoundedCornerShape(8.dp)
                                        )
                                        .clickable { selectedSlot = slot }
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
                        }
                    }

                    // Patient Name
                    OutlinedTextField(
                        value = patientName,
                        onValueChange = { patientName = it },
                        label = { Text("Patient Full Name") },
                        placeholder = { Text("e.g. John Smith") },
                        leadingIcon = {
                            Icon(Icons.Default.Person, contentDescription = "Name", tint = Slate400)
                        },
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
                        onValueChange = { patientPhone = it },
                        label = { Text("Contact Phone") },
                        placeholder = { Text("+1 (555) 000-0000") },
                        leadingIcon = {
                            Icon(Icons.Default.Phone, contentDescription = "Phone", tint = Slate400)
                        },
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
                        label = { Text("Email Address") },
                        placeholder = { Text("patient@example.com") },
                        leadingIcon = {
                            Icon(Icons.Default.Email, contentDescription = "Email", tint = Slate400)
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
                        label = { Text("Reason for Visit / Symptoms") },
                        placeholder = { Text("Briefly describe symptoms or routine checkup...") },
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
                            isSubmitted = true
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
                            text = "Confirm Appointment",
                            style = MaterialTheme.typography.titleMedium,
                            color = Color.White,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Icon(
                            imageVector = Icons.Default.ArrowForward,
                            contentDescription = "Confirm",
                            modifier = Modifier.size(16.dp)
                        )
                    }
                }
            }
        }
    }
}

