package com.docspace.template.ui.components

import androidx.compose.foundation.layout.*
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.docspace.template.config.DoctorConfig
import com.docspace.template.ui.theme.Slate100
import com.docspace.template.ui.theme.Slate400
import com.docspace.template.ui.theme.Slate600

@Composable
fun DocSpaceFooter() {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 24.dp, vertical = 32.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        HorizontalDivider(color = Slate100, thickness = 1.dp)
        Spacer(modifier = Modifier.height(20.dp))

        Text(
            text = "${DoctorConfig.CLINIC_NAME.ifBlank { DoctorConfig.DOCTOR_NAME }} • Powered by DocSpace",
            style = MaterialTheme.typography.bodySmall,
            color = Slate600,
            fontWeight = FontWeight.Medium,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(6.dp))

        Text(
            text = "For medical emergencies, please dial your local emergency services (e.g. 911 / 112 / 108) immediately.",
            style = MaterialTheme.typography.bodySmall,
            color = Slate400,
            fontSize = 11.sp,
            textAlign = TextAlign.Center,
            lineHeight = 16.sp
        )
    }
}

